import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { importTwinCatFile } from '@/catalog/importFile'
import { sourceKey } from '@/catalog/tree'
import { NOTE, REASON } from '@/catalog/access'
import { useBrowserStore } from '@/state/browserStore'
import { SymbolTree } from './SymbolTree'

const [source] = importTwinCatFile(
    't.tmc',
    `<TcModuleClass><DataTypes>
       <DataType><Name>ST_P</Name><SubItem><Name>x</Name><Type>REAL</Type><BitOffs>0</BitOffs></SubItem></DataType>
       <DataType><Name>FB_A</Name>
         <SubItem><Name>pP</Name><Type PointerTo="1">ST_P</Type><BitOffs>0</BitOffs></SubItem>
         <SubItem><Name>refP</Name><Type ReferenceTo="true">ST_P</Type><BitOffs>64</BitOffs></SubItem>
       </DataType>
     </DataTypes><Modules><Module><Name>P</Name><CLSID ClassFactory="TcPlc30">{x}</CLSID><DataAreas><DataArea><AreaNo AreaType="Internal">0</AreaNo><Name>I</Name>
       <Symbol><Name>MAIN.fb</Name><BaseType>FB_A</BaseType></Symbol>
     </DataArea></DataAreas></Module></Modules></TcModuleClass>`,
)
const key = (path: string) => `${source.id}|${path}`

beforeEach(() => {
    useBrowserStore.setState({
        expanded: new Set([sourceKey(source.id), key('MAIN/'), key('MAIN.fb'), key('MAIN.fb.pP'), key('MAIN.fb.refP')]),
        selection: new Map(),
        focused: null,
    })
})

describe('SymbolTree access rules', () => {
    it('shows a pointer muted with its reason and its ^ child selectable', () => {
        render(<SymbolTree sources={[source]} />)
        const pointer = screen.getByTitle(`MAIN.fb.pP — ${REASON.pointer}`)
        expect(pointer).toHaveClass('tree-row--muted')
        expect(pointer).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByText('^')).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: 'Select MAIN.fb.pP^' })).toBeInTheDocument()
    })
    it('marks symbols reached through a reference with a warning', () => {
        render(<SymbolTree sources={[source]} />)
        expect(screen.getByTitle(`MAIN.fb.refP.x — ${NOTE.viaReference}`)).not.toHaveClass('tree-row--muted')
        expect(screen.getAllByRole('img', { name: NOTE.viaReference }).length).toBeGreaterThan(0)
    })
})
