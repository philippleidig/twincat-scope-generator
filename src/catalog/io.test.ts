import { describe, expect, it } from 'vitest'
import { FIXTURES, fixture } from './__fixtures__/load'
import { importTwinCatFile } from './importFile'
import { IO_HINT, IO_NOTE } from './io'
import type { SymbolSource } from './model'
import { buildIndex } from './search'
import { resolvePath } from './walk'

const entry = (name: string, type: string, extra = '') => `<Entry Name="${name}" Index="#x6000" Sub="#x01"${extra}><Type>${type}</Type></Entry>`

/**
 * Modelled on a real project whose boot folder holds the symbol table TwinCAT built for the image
 * (stepper terminals linked to the NC in `Image`, the rest of the bus in `Image-2`); the corpus run
 * compares the importer with that table.
 */
const project = `<TcSmProject><Project TargetNetId="5.6.7.8.1.1"><Io>
  <Device Id="2" DevType="111" AmsPort="28674" RemoteName="Device 2 (EtherCAT)">
    <Name>Device 2 (EtherCAT)</Name>
    <Image Id="1" ImageFlags="#x00000030" AddrType="9" ImageType="3"><Name>Image</Name></Image>
    <Image Id="4" AddrType="10" ImageType="3"><Name>Image-2</Name></Image>
    <Box Id="1" BoxType="9099"><Name>Term 1 (EK1100)</Name><EtherCAT Desc="EK1100"/>
      <Box Id="2" BoxType="9099"><Name>X (EL7041-1000)</Name><EtherCAT Desc="EL7041-1000">
        <Pdo Name="ENC Status compact" Index="#x1a00" Flags="#x0010" SyncMan="3">
          ${entry('Status__Latch C valid', 'BIT')}
          ${entry('Status__', 'ARRAY [0..1] OF BIT')}
          ${entry('Status__Sync error', 'BIT')}
          ${entry('Counter value', 'UINT', ' Flags="#x00020000"')}
        </Pdo>
        <Pdo Name="ENC Status" Index="#x1a01" Flags="#x0010">${entry('Status__Latch C valid', 'BIT')}${entry('Counter value', 'UDINT')}</Pdo>
        <Pdo Name="STM Control" Index="#x1602" InOut="1" Flags="#x0010" SyncMan="2">
          ${entry('Control__Enable', 'BIT')}
          ${entry('Control__', 'ARRAY [0..4] OF BIT')}
          <Entry Name="Control__"><Type>ARRAY [0..0] OF BYTE</Type></Entry>
        </Pdo>
        <Pdo Name="STM Velocity" Index="#x1604" InOut="1" Flags="#x0010" SyncMan="2">${entry('Velocity', 'INT')}</Pdo>
      </EtherCAT></Box>
      <Box Id="3" BoxType="9099"><Name>Y (EL7041-1000)</Name><EtherCAT Desc="EL7041-1000">
        <Pdo Name="STM Velocity" Index="#x1604" InOut="1" Flags="#x0010" SyncMan="2">${entry('Velocity', 'INT')}</Pdo>
      </EtherCAT></Box>
      <Box Id="4" BoxType="9099"><Name>Output Card (EL2008)</Name><EtherCAT Desc="EL2008">
        <Pdo Name="Channel 1" Index="#x1600" InOut="1" Flags="#x0011" SyncMan="0">${entry('Output', 'BIT')}</Pdo>
      </EtherCAT></Box>
      <Box Id="5" BoxType="9099" Disabled="true"><Name>Spare (EL1008)</Name><EtherCAT Desc="EL1008">
        <Pdo Name="Channel 1" Index="#x1a00" Flags="#x0011" SyncMan="0">${entry('Input', 'BIT')}</Pdo>
      </EtherCAT></Box>
    </Box>
  </Device>
</Io></Project>
<Mappings>
  <OwnerA Name="TINC^NC-Task 1 SAF^Axes^X"><OwnerB Name="TIID^Device 2 (EtherCAT)^Term 1 (EK1100)^X (EL7041-1000)"><Link VarA="Enc^Inputs^In" VarB="ENC Status compact"/></OwnerB></OwnerA>
  <OwnerA Name="TINC^NC-Task 1 SAF^Axes^Y"><OwnerB Name="TIID^Device 2 (EtherCAT)^Term 1 (EK1100)^Y (EL7041-1000)^STM Velocity"/></OwnerA>
</Mappings></TcSmProject>`

const io = (sources: SymbolSource[]) => sources.filter((s) => s.kind === 'IO')
const paths = (source: SymbolSource) => buildIndex([source]).entries.map((e) => e.path)

describe('EtherCAT process image', () => {
    const [image, image2] = io(importTwinCatFile('cnc.tsproj', project))

    it('makes one source per image, on port 27904 + image id', () => {
        expect(image).toMatchObject({ kind: 'IO', title: 'Device 2 (EtherCAT) · Image', port: 27905, pathPrefix: '', amsNetId: '5.6.7.8.1.1', complete: true })
        expect(image2).toMatchObject({ title: 'Device 2 (EtherCAT) · Image-2', port: 27908 })
    })

    it('lists the device frame variables and one struct per assigned PDO, with WcState and InputToggle', () => {
        expect(image.roots.map((r) => [r.name, r.type, r.area])).toEqual([
            ['Inputs.Frm0State', 'UINT', 'input'],
            ['Inputs.Frm0WcState', 'UINT', 'input'],
            ['Inputs.Frm0InputToggle', 'UINT', 'input'],
            ['Outputs.Frm0Ctrl', 'UINT', 'output'],
            ['Outputs.Frm0WcCtrl', 'UINT', 'output'],
            ['X (EL7041-1000).ENC Status compact', 'ENC Status compact_TYPE', 'input'],
            ['X (EL7041-1000).STM Control', 'STM Control_TYPE', 'output'],
            ['X (EL7041-1000).STM Velocity', 'STM Velocity_TYPE', 'output'],
            ['X (EL7041-1000).WcState', 'BOOL', 'input'],
            ['X (EL7041-1000).InputToggle', 'BOOL', 'input'],
            ['Y (EL7041-1000).STM Velocity', 'STM Velocity_TYPE', 'output'],
            ['Y (EL7041-1000).WcState', 'BOOL', 'input'],
        ])
    })

    it('splits entry names at __ and drops padding and unassigned PDOs', () => {
        expect(paths(image).filter((p) => p.startsWith('X '))).toEqual([
            'X (EL7041-1000).ENC Status compact',
            'X (EL7041-1000).ENC Status compact.Counter value',
            'X (EL7041-1000).ENC Status compact.Status',
            'X (EL7041-1000).ENC Status compact.Status.Latch C valid',
            'X (EL7041-1000).ENC Status compact.Status.Sync error',
            'X (EL7041-1000).InputToggle',
            'X (EL7041-1000).STM Control',
            'X (EL7041-1000).STM Control.Control',
            'X (EL7041-1000).STM Control.Control.Enable',
            'X (EL7041-1000).STM Velocity',
            'X (EL7041-1000).STM Velocity.Velocity',
            'X (EL7041-1000).WcState',
        ])
        expect(resolvePath(image, 'X (EL7041-1000).ENC Status compact.Status.Sync error')?.resolved).toMatchObject({ kind: 'scalar', scopeType: 'BIT' })
        expect(resolvePath(image, 'X (EL7041-1000).STM Velocity.Velocity')).toMatchObject({ area: 'output', port: 27905 })
    })

    it('shares a type between boxes with the same PDO layout', () => {
        expect(image.roots.filter((r) => r.name.endsWith('STM Velocity')).map((r) => r.type)).toEqual(['STM Velocity_TYPE', 'STM Velocity_TYPE'])
    })

    it('puts boxes linked to the NC into the first image and the others into the second', () => {
        expect(image2.roots.map((r) => r.name)).toEqual(['Output Card (EL2008).Channel 1', 'Output Card (EL2008).WcState'])
        expect(image2.warnings.join(' ')).toMatch(/linked to the NC are listed under the first/)
    })

    it('warns only for the image whose ADS server is not enabled in the file', () => {
        expect(image.warnings.join(' ')).not.toMatch(/not enabled/)
        expect(image2.warnings.join(' ')).toMatch(/ADS server of "Device 2 \(EtherCAT\) › Image-2" is not enabled/)
        expect(image.warnings).toContain(IO_HINT)
    })
})

describe('PDO entry shapes', () => {
    const device = (pdos: string, extra = '') => `<TcSmItem><Device Id="1" DevType="111"${extra}><Name>D</Name><Image Id="1" ImageFlags="#x30"><Name>Image</Name></Image>
        <Box Id="1"><Name>T</Name><EtherCAT>${pdos}</EtherCAT></Box></Device></TcSmItem>`
    const load = (pdos: string, extra?: string) => io(importTwinCatFile('d.xti', device(pdos, extra)))[0]

    it('turns `X__ARRAY [i]` entries into an array', () => {
        const s = load(`<Pdo Name="PAI Samples 4" Index="#x1a03" SyncMan="3">${[0, 1, 2, 3].map((i) => entry(`Samples__ARRAY [${i}]`, 'DINT')).join('')}</Pdo>`)
        expect(paths(s)).toContain('T.PAI Samples 4.Samples[*]')
        expect(resolvePath(s, 'T.PAI Samples 4.Samples[3]')?.resolved).toMatchObject({ kind: 'scalar', scopeType: 'INT32' })
        expect(resolvePath(s, 'T.PAI Samples 4.Samples[4]')).toBeNull()
    })

    it('reads a PDO whose one entry carries its name as a single value', () => {
        const s = load(`<Pdo Name="Ch1 CycleCount" Index="#x1b00" SyncMan="3">${entry('Ch1 CycleCount', 'UINT')}</Pdo>`)
        expect(s.roots[5]).toMatchObject({ name: 'T.Ch1 CycleCount', type: 'UINT', area: 'input' })
    })

    it('keeps dots inside entry names', () => {
        const s = load(`<Pdo Name="CC Inputs" Index="#x1a00" SyncMan="3">${entry('Current actual value Ch.1', 'INT')}${entry('Current actual value Ch.10', 'INT')}</Pdo>`)
        expect(resolvePath(s, 'T.CC Inputs.Current actual value Ch.1')?.name).toBe('Current actual value Ch.1')
        expect(resolvePath(s, 'T.CC Inputs.Current actual value Ch.10')?.name).toBe('Current actual value Ch.10')
    })

    it('lists PDOs of a module below the module, with a note', () => {
        const s = load(`<Pdo Name="DIO Inputs" Index="#x1a01" SyncMan="3">${entry('Input 0', 'BIT')}</Pdo>
            <Slot><Module><Name>Module 2 (DIO)</Name><PdoIndex>6657</PdoIndex></Module></Slot>`)
        expect(s.roots[5]).toMatchObject({ name: 'T.Module 2 (DIO).DIO Inputs', note: IO_NOTE.module })
    })

    it('flags a disabled device', () => {
        expect(load('', ' Disabled="true"').warnings[0]).toMatch(/device is disabled/)
    })

    it('gives a different layout under the same PDO name its own type', () => {
        const s = io(
            importTwinCatFile(
                'd.xti',
                `<TcSmItem><Device Id="1" DevType="111"><Name>D</Name><Image Id="1"><Name>Image</Name></Image>
                <Box Id="1"><Name>A</Name><EtherCAT><Pdo Name="Inputs" Index="#x1a00" SyncMan="3">${entry('Value', 'INT')}</Pdo></EtherCAT></Box>
                <Box Id="2"><Name>B</Name><EtherCAT><Pdo Name="Inputs" Index="#x1a00" SyncMan="3">${entry('Value', 'DINT')}</Pdo></EtherCAT></Box>
                </Device></TcSmItem>`,
            ),
        )[0]
        expect(s.roots.filter((r) => r.name.endsWith('.Inputs')).map((r) => r.type)).toEqual(['Inputs_TYPE', 'Inputs_TYPE (2)'])
        expect(resolvePath(s, 'B.Inputs.Value')?.resolved).toMatchObject({ scopeType: 'INT32' })
    })
})

describe('other I/O devices', () => {
    it('reads <Vars> of fieldbus boxes and their modules, marked as not verified', () => {
        const [s] = io(
            importTwinCatFile(
                'p.tsproj',
                `<TcSmProject><Project><Io><Device Id="2" DevType="86"><Name>Device 2 (EL6731)</Name><Image Id="6"><Name>Image</Name></Image>
                <Box Id="10"><Name>Box 10 (GSD Box)</Name>
                  <Vars VarGrpType="1"><Name>Inputs</Name><Var><Name>DpState</Name><Type>USINT</Type></Var></Vars>
                  <Profibus><GsdModule Id="1"><Name>Module 1 (PPO1)</Name>
                    <Vars VarGrpType="2"><Name>Outputs</Name><Var><Name>PPO1_1_0</Name><Type>WORD</Type><ArrayInfo><LBound>0</LBound><Elements>4</Elements></ArrayInfo></Var></Vars>
                  </GsdModule></Profibus>
                </Box></Device></Io></Project></TcSmProject>`,
            ),
        )
        expect(s).toMatchObject({ title: 'Device 2 (EL6731)', port: 27910 })
        expect(s.roots.map((r) => [r.name, r.area])).toEqual([
            ['Box 10 (GSD Box).Inputs.DpState', 'input'],
            ['Box 10 (GSD Box).Module 1 (PPO1).Outputs.PPO1_1_0', 'output'],
        ])
        expect(s.warnings.join(' ')).toMatch(/not verified/)
    })

    it('reads device-level <Vars> and skips devices without symbols', () => {
        const sources = io(
            importTwinCatFile(
                'v.tsproj',
                `<TcSmProject><Project><Io>
                <Device Id="1" DevType="160"><Name>Device 1 (OPC UA Virtual)</Name><Vars VarGrpType="2"><Name>Outputs</Name><Var><Name>nValue</Name><Type>DINT</Type></Var></Vars><Image Id="1"><Name>Image</Name></Image></Device>
                <Device Id="2" DevType="11"><Name>COM</Name><Image Id="5"><Name>Image</Name></Image></Device>
                <Device Id="3" DevType="109"><Name>RT-Ethernet</Name></Device>
                </Io></Project></TcSmProject>`,
            ),
        )
        expect(sources.map((s) => [s.title, s.roots.map((r) => r.name)])).toEqual([['Device 1 (OPC UA Virtual)', ['Outputs.nValue']]])
    })

    it('reads a terminal exported on its own, whose port it cannot know', () => {
        const [s] = importTwinCatFile(FIXTURES.ethercatXti, fixture(FIXTURES.ethercatXti))
        const box = FIXTURES.ethercatXti.replace('.xti', '')
        expect(s).toMatchObject({ kind: 'IO', title: box, port: 27905 })
        expect(s.roots.map((r) => r.name)).toContain(`${box}.Channel 8`)
        expect(resolvePath(s, `${box}.Channel 8.Output`)?.resolved).toMatchObject({ kind: 'scalar', scopeType: 'BIT' })
        expect(s.warnings[0]).toMatch(/without its device/)
    })
})
