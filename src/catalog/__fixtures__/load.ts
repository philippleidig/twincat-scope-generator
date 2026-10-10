import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Contents of a fixture file in this folder (tests only). */
export function fixture(name: string): string {
    return readFileSync(resolve(process.cwd(), 'src/catalog/__fixtures__', name), 'utf8')
}

export const FIXTURES = {
    plcTmc: 'Beckhoff__TF6000_ADS_DOTNET_V5_Samples__PLC.tmc',
    inheritanceTmc: '0w8States__PLC-Design-Patterns__Strategy_PLC1.tmc',
    tcomTmc: 'Beckhoff__TF6311_Samples__TCPServer.tmc',
    ncAxisXti: 'pcdshub__lcls-twincat-motion__NC_Axis_TestStateInitTiming.xti',
    ncTaskXti: 'pcdshub__lcls-twincat-motion__NC.xti',
    plcXti: 'pcdshub__lcls-twincat-motion__PLC_Library.xti',
    splitTsproj: 'pcdshub__lcls-twincat-motion__lcls-twincat-motion.tsproj',
    tcomXti: 'Beckhoff-USA-Community__MIL-SIL-HIL-Simulink-TwinCAT__TcCOM_TempCtrl.xti',
    ethercatXti: 'RodrigoSoares256__TwinCAT-Projects__EtherCATDiag_Term2_EL2008.xti',
} as const
