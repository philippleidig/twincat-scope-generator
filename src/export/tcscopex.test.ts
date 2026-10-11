import { describe, expect, it } from 'vitest'
import { createProject, ops } from '@/domain/project'
import type { Project } from '@/domain/project'
import { generateProject, generateTcmprojXml, planProject, toArgb } from './tcscopex'

const sequentialIds = () => {
    let n = 0
    return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
}

function sample(): Project {
    let p = createProject()
    p = ops.addTarget(p, { name: 'IPC', amsNetId: '10.1.2.3.1.1' })
    const g1 = p.scopeFiles[0].axisGroups[0].id
    p = ops.addChannels(p, g1, [
        { symbol: 'GVL.aAxis[{i:1:2}].fActPos', dataType: 'REAL64', port: 851 },
        { symbol: 'MAIN.b & <c>', dataType: 'BIT', port: 852, targetId: p.targets[1].id },
        { symbol: 'broken{', dataType: 'INT16', port: 851 },
        { symbol: '', dataType: 'INT16', port: 851 },
    ])
    return p
}

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml')

describe('planProject', () => {
    it('expands channels and skips invalid/empty ones', () => {
        const [file] = planProject(sample(), sequentialIds())
        const acq = file.axisGroups[0].acquisitions
        expect(acq.map((a) => a.symbolName)).toEqual(['GVL.aAxis[1].fActPos', 'GVL.aAxis[2].fActPos', 'MAIN.b & <c>'])
        expect(acq.map((a) => a.amsNetId)).toEqual(['127.0.0.1.1.1', '127.0.0.1.1.1', '10.1.2.3.1.1'])
        expect(acq[2]).toMatchObject({ targetPort: 852, dataType: 'BIT', baseSampleTime: 100_000 })
        expect(file.acquisitionCount).toBe(3)
    })

    it('drops empty axis groups and files', () => {
        let p = sample()
        p = ops.addScopeFile(p)
        p = ops.addAxisGroup(p, p.scopeFiles[0].id)
        const plan = planProject(p)
        expect(plan).toHaveLength(1)
        expect(plan[0].axisGroups).toHaveLength(1)
    })

    it('makes file names unique and file-system safe', () => {
        let p = sample()
        p = ops.duplicateScopeFile(p, p.scopeFiles[0].id)
        p = ops.updateScopeFile(p, p.scopeFiles[1].id, { name: 'Scope_1' })
        p = ops.addScopeFile(p)
        p = ops.updateScopeFile(p, p.scopeFiles[2].id, { name: '../a:b' })
        p = ops.addChannels(p, p.scopeFiles[2].axisGroups[0].id, [{ symbol: 'x' }])
        expect(planProject(p).map((f) => f.fileName)).toEqual(['Scope_1.tcscopex', 'Scope_1_2.tcscopex', '.._a_b.tcscopex'])
    })
})

describe('generateProject', () => {
    it('produces well-formed XML with matching acquisition/channel references', () => {
        const { scopeFiles, tcmproj } = generateProject(sample(), sequentialIds())
        expect(scopeFiles).toHaveLength(1)
        const doc = parse(scopeFiles[0].content)
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
        const acquisitions = [...doc.getElementsByTagName('AdsAcquisition')]
        expect(acquisitions).toHaveLength(3)
        const guids = acquisitions.map((a) => a.getElementsByTagName('Guid')[0].textContent)
        const referenced = [...doc.getElementsByTagName('AcquisitionGUID')].map((e) => e.textContent)
        expect(referenced).toEqual(guids)
        expect(acquisitions[2].getElementsByTagName('SymbolName')[0].textContent).toBe('MAIN.b & <c>')
        expect(acquisitions[2].getElementsByTagName('AmsNetId')[0].textContent).toBe('10.1.2.3.1.1')
        expect(acquisitions[2].getElementsByTagName('VariableSize')[0].textContent).toBe('1')
        expect(acquisitions[0].getElementsByTagName('VariableSize')[0].textContent).toBe('8')
        expect(doc.getElementsByTagName('RecordTime')[0].textContent).toBe('6000000000')

        expect(tcmproj.fileName).toBe('Scope_Project.tcmproj')
        expect(tcmproj.acquisitionCount).toBe(3)
        expect(parse(tcmproj.content).getElementsByTagName('Content')[0].getAttribute('Include')).toBe('Scope_1.tcscopex')
    })

    it('is deterministic for a given id generator (golden file)', () => {
        const { scopeFiles, tcmproj } = generateProject(sample(), sequentialIds())
        expect(scopeFiles[0].content).toMatchSnapshot()
        expect(tcmproj.content).toMatchSnapshot()
    })

    it('writes display names and colours (golden file)', () => {
        let p = createProject()
        const g = p.scopeFiles[0].axisGroups[0].id
        p = ops.addChannels(p, g, [
            { symbol: 'GVL.aAxis[{i:1:2}].fActPos', name: 'Axis {i} <pos>', color: '#ff0000' },
            { symbol: 'MAIN.b', color: '#123456' },
            { symbol: 'MAIN.c' },
        ])
        const xml = generateProject(p, sequentialIds()).scopeFiles[0].content
        const doc = parse(xml)
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)

        const channels = [...doc.getElementsByTagName('Channel')]
        const child = (el: Element, tag: string) => [...el.children].find((c) => c.tagName === tag)!.textContent
        const subMember = (el: Element) => [...el.children].find((c) => c.tagName === 'SubMember')!
        // The channel-level name relation is a direct child of the channel's SubMember.
        const usedNameType = (el: Element) => child([...subMember(el).children].find((c) => c.tagName === 'NameRelationInfo')!, 'UsedNameType')
        const series = (el: Element) => el.getElementsByTagName('SeriesStyle')[0]

        expect(channels.map((c) => child(c, 'Name'))).toEqual(['Axis 1 <pos>', 'Axis 2 <pos>', 'MAIN.b', 'MAIN.c'])
        expect(channels.map(usedNameType)).toEqual(['Custom', 'Custom', 'Acquisition', 'Acquisition'])
        expect(channels.map((c) => c.getElementsByTagName('AcquisitionInterpreter')[0].getElementsByTagName('Name')[0].textContent)).toEqual([
            'Y: GVL.aAxis[1].fActPos',
            'Y: GVL.aAxis[2].fActPos',
            'Y: MAIN.b',
            'Y: MAIN.c',
        ])
        // Acquisitions keep the symbol names.
        expect([...doc.getElementsByTagName('AdsAcquisition')].map((a) => child(a, 'Name'))).toEqual([
            'GVL.aAxis[1].fActPos',
            'GVL.aAxis[2].fActPos',
            'MAIN.b',
            'MAIN.c',
        ])
        // Red, then the next palette colour (yellow); a custom colour; the automatic colour of position 3 (yellow).
        const expected = [-65536, -256, toArgb('#123456'), -256].map(String)
        expect(channels.map((c) => child(c, 'DisplayColor'))).toEqual(expected)
        expect(channels.map((c) => child(series(c), 'DisplayColor'))).toEqual(expected)
        expect(channels.map((c) => child(series(c), 'MarkColor'))).toEqual(expected)
        expect(xml).toMatchSnapshot()
    })

    it('converts #rrggbb to signed ARGB', () => {
        expect(toArgb('#008000')).toBe(-16744448)
        expect(toArgb('#FFFFFF')).toBe(-1)
        expect(toArgb('#000000')).toBe(-16777216)
        expect(toArgb('#123456')).toBe(-15584170)
    })

    it('escapes the project name', () => {
        const xml = generateTcmprojXml('A & "B" <C>', ['x.tcscopex'], sequentialIds())
        expect(xml).toContain('<Name>A &amp; &quot;B&quot; &lt;C&gt;</Name>')
    })
})
