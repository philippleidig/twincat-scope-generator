import { v4 as uuidv4 } from 'uuid'
import type {
  AdsAcquisition,
  GlobalSettings,
  Pattern,
  ScopeFile,
  GeneratedFile,
  GenerationResult,
  DataType,
} from '@/types'
import { expandAllSymbols } from '@/lib/patterns'

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate a new GUID
 */
function generateGuid(): string {
  return uuidv4()
}

/**
 * Generate AdsAcquisition entries from a pattern
 */
export function generateAcquisitionsFromPattern(
  pattern: Pattern,
  globalSettings: GlobalSettings
): AdsAcquisition[] {
  const acquisitions: AdsAcquisition[] = []

  for (const symbol of pattern.symbols) {
    if (!symbol.template.trim()) continue

    const expandedSymbols = expandAllSymbols(symbol.template)

    for (const symbolName of expandedSymbols) {
      acquisitions.push({
        guid: generateGuid(),
        name: symbolName,
        symbolName: symbolName,
        amsNetId: globalSettings.amsNetId,
        targetPort: pattern.targetPort,
        dataType: symbol.dataType,
        variableSize: symbol.variableSize,
        baseSampleTime: globalSettings.baseSampleTime,
        enabled: true,
      })
    }
  }

  return acquisitions
}

/**
 * Generate XML for a single AdsAcquisition
 */
function generateAdsAcquisitionXml(acq: AdsAcquisition, indent: string = '        '): string {
  return `${indent}<AdsAcquisition AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}  <AmsNetId>${escapeXml(acq.amsNetId)}</AmsNetId>
${indent}  <Area>Local</Area>
${indent}  <ArrayLength>0</ArrayLength>
${indent}  <BaseSampleTime>${acq.baseSampleTime}</BaseSampleTime>
${indent}  <ChannelStyleInformation />
${indent}  <Comment></Comment>
${indent}  <CompressionMode>Uncompressed</CompressionMode>
${indent}  <ContextMask>0</ContextMask>
${indent}  <DataAccess>
${indent}    <DataAccessMode>
${indent}      <Source>TwinCAT</Source>
${indent}      <Protocoll>ADS</Protocoll>
${indent}      <Format>TcBinary</Format>
${indent}      <TimeContext>Present</TimeContext>
${indent}      <TimeTangeInfo>
${indent}        <StartTimeStamp>0</StartTimeStamp>
${indent}        <EndTimeStamp>0</EndTimeStamp>
${indent}      </TimeTangeInfo>
${indent}    </DataAccessMode>
${indent}  </DataAccess>
${indent}  <DataType>${acq.dataType}</DataType>
${indent}  <DisplayColor>Black</DisplayColor>
${indent}  <Enabled>${acq.enabled}</Enabled>
${indent}  <FileHandle>0</FileHandle>
${indent}  <ForceOversampling>false</ForceOversampling>
${indent}  <Guid>${acq.guid}</Guid>
${indent}  <IndexGroup>16448</IndexGroup>
${indent}  <IndexOffset>0</IndexOffset>
${indent}  <IsEvent>false</IsEvent>
${indent}  <IsHistorical>false</IsHistorical>
${indent}  <IsTimeline>false</IsTimeline>
${indent}  <Name>${escapeXml(acq.name)}</Name>
${indent}  <Oversample>0</Oversample>
${indent}  <RawUnit>
${indent}    <Transformation>
${indent}      <BaseUnitValue>0</BaseUnitValue>
${indent}      <Name>None</Name>
${indent}      <ScaleFactor>1</ScaleFactor>
${indent}      <SourceUnitPrefix>none</SourceUnitPrefix>
${indent}      <SourceUnitString />
${indent}      <Symbol>1</Symbol>
${indent}      <TargetUnitString />
${indent}      <TargetUnitValue>0</TargetUnitValue>
${indent}    </Transformation>
${indent}    <Unit>
${indent}      <BaseUnitString />
${indent}      <BaseUnitValue>0</BaseUnitValue>
${indent}      <NameExtension />
${indent}      <Offset>0</Offset>
${indent}      <Prefix>none</Prefix>
${indent}      <ReturnText> (None) </ReturnText>
${indent}      <ScaleFactor>1</ScaleFactor>
${indent}      <Symbol></Symbol>
${indent}    </Unit>
${indent}    <UnitOffsetResult>0</UnitOffsetResult>
${indent}    <UnitScaleResult>1</UnitScaleResult>
${indent}    <UserUnit>
${indent}      <BaseName>UnitOfOne</BaseName>
${indent}      <BaseUnitString />
${indent}      <BaseUnitValue>0</BaseUnitValue>
${indent}      <Name>None</Name>
${indent}      <NameExtension />
${indent}      <Offset>0</Offset>
${indent}      <Prefix>none</Prefix>
${indent}      <ScaleFactor>1</ScaleFactor>
${indent}      <Symbol></Symbol>
${indent}      <UserPrefix>none</UserPrefix>
${indent}    </UserUnit>
${indent}  </RawUnit>
${indent}  <SaveOption>IncludeDataInSVDX</SaveOption>
${indent}  <ServerHandle>0</ServerHandle>
${indent}  <SortPriority>10</SortPriority>
${indent}  <SubAdsAcquisition />
${indent}  <SubMember>
${indent}    <NameRelationInfo AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}      <Comment />
${indent}      <DetailLevel>
${indent}        <Int32>0</Int32>
${indent}        <Int32>1</Int32>
${indent}        <Int32>2</Int32>
${indent}        <Int32>3</Int32>
${indent}      </DetailLevel>
${indent}      <DisplayColor>Black</DisplayColor>
${indent}      <Guid>${generateGuid()}</Guid>
${indent}      <Name>MeasurementMemberBase</Name>
${indent}      <SortPriority>100</SortPriority>
${indent}      <Title>MeasurementMemberBase</Title>
${indent}      <UsedNameType>DetailLevel</UsedNameType>
${indent}    </NameRelationInfo>
${indent}  </SubMember>
${indent}  <SymbolBased>true</SymbolBased>
${indent}  <SymbolName>${escapeXml(acq.symbolName)}</SymbolName>
${indent}  <TargetPort>${acq.targetPort}</TargetPort>
${indent}  <TimeOffset>0</TimeOffset>
${indent}  <Title>MeasurementMemberBase</Title>
${indent}  <UseLocalServer>true</UseLocalServer>
${indent}  <UseTaskSampleTime>true</UseTaskSampleTime>
${indent}  <UTF8Encoding>false</UTF8Encoding>
${indent}  <VariableSize>${acq.variableSize}</VariableSize>
${indent}</AdsAcquisition>`
}

/**
 * Generate complete tcscopex XML content
 */
export function generateTcscopexXml(
  globalSettings: GlobalSettings,
  acquisitions: AdsAcquisition[]
): string {
  const projectGuid = generateGuid()
  const dataPoolGuid = generateGuid()
  const windowGuid = generateGuid()
  const containerGuid = generateGuid()

  const acquisitionsXml = acquisitions
    .map((acq) => generateAdsAcquisitionXml(acq))
    .join('\n')

  return `<?xml version="1.0" encoding="utf-8"?>
<ScopeProject AssemblyName="TwinCAT.Measurement.Scope.API.Model">
  <ActiveWorkfolderPath></ActiveWorkfolderPath>
  <AutoDeleteCapacity>0</AutoDeleteCapacity>
  <AutoDeleteMode>Disabled</AutoDeleteMode>
  <AutoDeleteOlderThan>0</AutoDeleteOlderThan>
  <AutoRestartRecord>false</AutoRestartRecord>
  <AutoSaveExportConfigurationString>&lt;?xml version="1.0" encoding="utf-8"?&gt;
&lt;ExportConfiguration&gt;
  &lt;Silent&gt;False&lt;/Silent&gt;
  &lt;Format_Properties&gt;
	&lt;CSVProperties&gt;
	&lt;/CSVProperties&gt;
  &lt;/Format_Properties&gt;
&lt;/ExportConfiguration&gt;
</AutoSaveExportConfigurationString>
  <AutoSaveFileNameMask>{SCOPE}_AutoSave_{HH_mm_ss}</AutoSaveFileNameMask>
  <AutoSaveMode>None</AutoSaveMode>
  <AutoSavePath>$ScopeProject$\\AutoSave</AutoSavePath>
  <Comment />
  <DisplayColor>Black</DisplayColor>
  <Guid>${projectGuid}</Guid>
  <HeadlessServer />
  <HeadlessServerConnectionId>00000000-0000-0000-0000-000000000000</HeadlessServerConnectionId>
  <ImageAutoDeleteCapacity>0</ImageAutoDeleteCapacity>
  <ImageAutoDeleteOlderThan>0</ImageAutoDeleteOlderThan>
  <ImagesDeleteMode>Disabled</ImagesDeleteMode>
  <KeepPreviousExports>true</KeepPreviousExports>
  <KeepPreviousImageExports>true</KeepPreviousImageExports>
  <Layout>&lt;?xml version="1.0" encoding="utf-16"?&gt;
&lt;Layout&gt;
  &lt;Window Guid="${windowGuid}" LastFocused="0" DockedSize="200" PopupSize="0" FloatingLocation="-1, -1" FloatingSize="550, 400" LastOpenDockSituation="Document" LastFixedDockSituation="Document" LastFixedDockLocation="Right" LastFloatingWindowGuid="00000000-0000-0000-0000-000000000000" LastDockContainerCount="0" LastDockContainerIndex="0" DockedWorkingSize="250, 400" DockedWindowGroupGuid="00000000-0000-0000-0000-000000000000" DockedIndexInWindowGroup="0" DockedSplitPath="0" DocumentWorkingSize="250, 400" DocumentWindowGroupGuid="${containerGuid}" DocumentIndexInWindowGroup="0" DocumentSplitPath="0" FloatingWorkingSize="250, 400" FloatingWindowGroupGuid="00000000-0000-0000-0000-000000000000" FloatingIndexInWindowGroup="0" FloatingSplitPath="0" /&gt;
  &lt;DocumentContainer Dock="5"&gt;
    &lt;SplitLayoutSystem WorkingSize="250, 400" SplitMode="0"&gt;
      &lt;ControlLayoutSystem WorkingSize="250, 400" Guid="${containerGuid}" Collapsed="0" SelectedControl="${windowGuid}"&gt;
        &lt;Controls&gt;
          &lt;Control Guid="${windowGuid}" /&gt;
        &lt;/Controls&gt;
      &lt;/ControlLayoutSystem&gt;
    &lt;/SplitLayoutSystem&gt;
  &lt;/DocumentContainer&gt;
&lt;/Layout&gt;</Layout>
  <MainServer>${escapeXml(globalSettings.mainServer)}</MainServer>
  <Name>${escapeXml(globalSettings.projectName)}</Name>
  <RecordTime>${globalSettings.recordTime}</RecordTime>
  <ServerVersions />
  <SortPriority>100</SortPriority>
  <StopMode>AutoStop</StopMode>
  <SubMember>
    <DataPool AssemblyName="TwinCAT.Measurement.Scope.API.Model">
      <Comment />
      <DisplayColor>Black</DisplayColor>
      <Guid>${dataPoolGuid}</Guid>
      <Name>DataPool</Name>
      <SortPriority>0</SortPriority>
      <SubMember>
${acquisitionsXml}
      </SubMember>
    </DataPool>
  </SubMember>
</ScopeProject>`
}

/**
 * Generate tcmproj XML content bundling multiple tcscopex files
 */
export function generateTcmprojXml(
  projectName: string,
  fileNames: string[]
): string {
  const projectGuid = generateGuid()

  const contentItems = fileNames
    .map(
      (fileName) => `    <Content Include="${escapeXml(fileName)}">
      <SubType>Content</SubType>
    </Content>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="utf-8"?>
<Project ToolsVersion="4.0" DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <PropertyGroup>
    <Configuration Condition=" '$(Configuration)' == '' ">Debug</Configuration>
    <SchemaVersion>2.0</SchemaVersion>
    <ProjectGuid>{${projectGuid}}</ProjectGuid>
    <OutputType>Exe</OutputType>
    <RootNamespace>MyApplication</RootNamespace>
    <AssemblyName>MyApplication</AssemblyName>
    <Name>${escapeXml(projectName)}</Name>
  </PropertyGroup>
  <ItemGroup>
${contentItems}
  </ItemGroup>
</Project>`
}

/**
 * Get variable size for a data type
 */
export function getVariableSizeForDataType(dataType: DataType): number {
  const sizes: Record<DataType, number> = {
    BIT: 1,
    INT8: 1,
    INT16: 2,
    INT32: 4,
    INT64: 8,
    UINT8: 1,
    UINT16: 2,
    UINT32: 4,
    UINT64: 8,
    REAL32: 4,
    REAL64: 8,
  }
  return sizes[dataType]
}

/**
 * Generate all files from scope files
 */
export function generateAllFiles(
  globalSettings: GlobalSettings,
  scopeFiles: ScopeFile[]
): GenerationResult {
  const files: GeneratedFile[] = []

  // Generate tcscopex files
  for (const scopeFile of scopeFiles) {
    if (scopeFile.patterns.length === 0) continue

    const fileName = `${scopeFile.name}.tcscopex`

    // Generate all acquisitions for this file
    const acquisitions: AdsAcquisition[] = []

    for (const pattern of scopeFile.patterns) {
      acquisitions.push(...generateAcquisitionsFromPattern(pattern, globalSettings))
    }

    if (acquisitions.length === 0) continue

    const content = generateTcscopexXml(globalSettings, acquisitions)

    files.push({
      fileName,
      content,
      acquisitionCount: acquisitions.length,
    })
  }

  // Generate tcmproj file
  const fileNames = files.map((f) => f.fileName)
  const tcmprojFileName = `${globalSettings.projectName.replace(/\s+/g, '_')}.tcmproj`
  const tcmprojContent = generateTcmprojXml(globalSettings.projectName, fileNames)

  return {
    tcscopexFiles: files,
    tcmprojContent,
    tcmprojFileName,
  }
}
