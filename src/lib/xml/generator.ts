import { v4 as uuidv4 } from 'uuid'
import type {
  AdsAcquisition,
  AxisGroup,
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
 * Acquisitions grouped by axis group for XML generation
 */
interface AxisGroupAcquisitions {
  axisGroup: AxisGroup
  acquisitions: AdsAcquisition[]
}

/**
 * Channel colors (TwinCAT uses ARGB as signed int32)
 */
const CHANNEL_COLORS = [
  -16744448,  // Green
  -16776961,  // Blue
  -65536,     // Red
  -256,       // Yellow
  -16711681,  // Cyan
  -65281,     // Magenta
  -23296,     // Orange
  -8388480,   // Purple
]

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
 * Generate XML for a single Channel referencing an acquisition
 */
function generateChannelXml(acq: AdsAcquisition, sortPriority: number, colorIndex: number, indent: string): string {
  const channelGuid = generateGuid()
  const color = CHANNEL_COLORS[colorIndex % CHANNEL_COLORS.length]
  const name = escapeXml(acq.name)

  return `${indent}<Channel AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}  <Comment />
${indent}  <DisplayColor>${color}</DisplayColor>
${indent}  <Enabled>true</Enabled>
${indent}  <Guid>${channelGuid}</Guid>
${indent}  <Name>${name}</Name>
${indent}  <SortPriority>${sortPriority}</SortPriority>
${indent}  <SubMember>
${indent}    <AcquisitionInterpreter AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}      <AcquisitionGUID>${acq.guid}</AcquisitionGUID>
${indent}      <ArrayIndex>0</ArrayIndex>
${indent}      <BitMask>18446744073709551615</BitMask>
${indent}      <Comment />
${indent}      <DisplayColor>Black</DisplayColor>
${indent}      <Guid>${generateGuid()}</Guid>
${indent}      <Name>Y: ${name}</Name>
${indent}      <Offset>0</Offset>
${indent}      <ResultingUnit>
${indent}        <Transformation>
${indent}          <BaseUnitValue>0</BaseUnitValue>
${indent}          <Name>None</Name>
${indent}          <ScaleFactor>1</ScaleFactor>
${indent}          <SourceUnitPrefix>none</SourceUnitPrefix>
${indent}          <SourceUnitString />
${indent}          <Symbol>1</Symbol>
${indent}          <TargetUnitString />
${indent}          <TargetUnitValue>0</TargetUnitValue>
${indent}        </Transformation>
${indent}        <Unit>
${indent}          <BaseUnitString />
${indent}          <BaseUnitValue>0</BaseUnitValue>
${indent}          <NameExtension />
${indent}          <Offset>0</Offset>
${indent}          <Prefix>none</Prefix>
${indent}          <ReturnText> (None) </ReturnText>
${indent}          <ScaleFactor>1</ScaleFactor>
${indent}          <Symbol></Symbol>
${indent}        </Unit>
${indent}        <UnitOffsetResult>0</UnitOffsetResult>
${indent}        <UnitScaleResult>1</UnitScaleResult>
${indent}        <UserUnit>
${indent}          <BaseName>UnitOfOne</BaseName>
${indent}          <BaseUnitString />
${indent}          <BaseUnitValue>0</BaseUnitValue>
${indent}          <Name>None</Name>
${indent}          <NameExtension />
${indent}          <Offset>0</Offset>
${indent}          <Prefix>none</Prefix>
${indent}          <ScaleFactor>1</ScaleFactor>
${indent}          <Symbol></Symbol>
${indent}          <UserPrefix>none</UserPrefix>
${indent}        </UserUnit>
${indent}      </ResultingUnit>
${indent}      <ScaleFactor>1</ScaleFactor>
${indent}      <ShortInfo />
${indent}      <SortPriority>2</SortPriority>
${indent}      <SubMember>
${indent}        <NameRelationInfo AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}          <Comment />
${indent}          <DetailLevel>
${indent}            <Int32>0</Int32>
${indent}          </DetailLevel>
${indent}          <DisplayColor>Black</DisplayColor>
${indent}          <Guid>${generateGuid()}</Guid>
${indent}          <Name>MeasurementMemberBase</Name>
${indent}          <SortPriority>100</SortPriority>
${indent}          <Title>MeasurementMemberBase</Title>
${indent}          <UsedNameType>Acquisition</UsedNameType>
${indent}        </NameRelationInfo>
${indent}      </SubMember>
${indent}      <Title>MeasurementMemberBase</Title>
${indent}      <Usage>Y</Usage>
${indent}    </AcquisitionInterpreter>
${indent}    <ChannelStyle AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}      <Comment />
${indent}      <DisplayColor>Black</DisplayColor>
${indent}      <Guid>${generateGuid()}</Guid>
${indent}      <Name>Channel Style</Name>
${indent}      <SortPriority>100</SortPriority>
${indent}      <SubMember>
${indent}        <SeriesStyle AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}          <Antialias>true</Antialias>
${indent}          <Comment />
${indent}          <DisplayColor>${color}</DisplayColor>
${indent}          <FillColor>838893568</FillColor>
${indent}          <FillMode>None</FillMode>
${indent}          <Guid>${generateGuid()}</Guid>
${indent}          <LineWidth>2</LineWidth>
${indent}          <MarkColor>${color}</MarkColor>
${indent}          <MarkSize>2</MarkSize>
${indent}          <MarkState>Auto</MarkState>
${indent}          <Name>Series Style</Name>
${indent}          <SeriesType>Line</SeriesType>
${indent}          <SortPriority>100</SortPriority>
${indent}          <Title>MeasurementMemberBase</Title>
${indent}        </SeriesStyle>
${indent}        <MinMaxStyle AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}          <Comment />
${indent}          <DisplayColor>Black</DisplayColor>
${indent}          <Guid>${generateGuid()}</Guid>
${indent}          <Name>Min/Max Style</Name>
${indent}          <ShowMax>false</ShowMax>
${indent}          <ShowMin>false</ShowMin>
${indent}          <SortPriority>100</SortPriority>
${indent}          <Title>MeasurementMemberBase</Title>
${indent}        </MinMaxStyle>
${indent}        <TimeShiftStyle AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}          <Comment />
${indent}          <DisplayColor>Black</DisplayColor>
${indent}          <Guid>${generateGuid()}</Guid>
${indent}          <Name>MeasurementMemberBase</Name>
${indent}          <SortPriority>100</SortPriority>
${indent}          <TimeShift>0</TimeShift>
${indent}          <Title>MeasurementMemberBase</Title>
${indent}        </TimeShiftStyle>
${indent}      </SubMember>
${indent}      <Title>MeasurementMemberBase</Title>
${indent}      <Visible>true</Visible>
${indent}    </ChannelStyle>
${indent}    <NameRelationInfo AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}      <Comment />
${indent}      <DetailLevel>
${indent}        <Int32>0</Int32>
${indent}      </DetailLevel>
${indent}      <DisplayColor>Black</DisplayColor>
${indent}      <Guid>${generateGuid()}</Guid>
${indent}      <Name>MeasurementMemberBase</Name>
${indent}      <SortPriority>100</SortPriority>
${indent}      <Title>MeasurementMemberBase</Title>
${indent}      <UsedNameType>Acquisition</UsedNameType>
${indent}    </NameRelationInfo>
${indent}  </SubMember>
${indent}  <Title>MeasurementMemberBase</Title>
${indent}</Channel>`
}

/**
 * Generate XML for a single AxisGroup with its channels
 */
function generateAxisGroupXml(agAcq: AxisGroupAcquisitions, sortPriority: number, indent: string): string {
  const channelsXml = agAcq.acquisitions
    .map((acq, i) => generateChannelXml(acq, 10 + i, i, `${indent}    `))
    .join('\n')

  return `${indent}<AxisGroup AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}  <ChannelRelatedGuid>00000000-0000-0000-0000-000000000000</ChannelRelatedGuid>
${indent}  <Comment />
${indent}  <DisplayColor>-657931</DisplayColor>
${indent}  <Enabled>true</Enabled>
${indent}  <Guid>${generateGuid()}</Guid>
${indent}  <Name>${escapeXml(agAcq.axisGroup.name)}</Name>
${indent}  <ShowTitle>False</ShowTitle>
${indent}  <SortPriority>${sortPriority}</SortPriority>
${indent}  <SubMember>
${indent}    <TimeAxis AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}      <AbsoluteTimesFormat>HH:mm:ss.fff</AbsoluteTimesFormat>
${indent}      <Comment />
${indent}      <DisplayColor>Black</DisplayColor>
${indent}      <Guid>${generateGuid()}</Guid>
${indent}      <Inverted>false</Inverted>
${indent}      <Logarithmic>false</Logarithmic>
${indent}      <ManualMax>100000000</ManualMax>
${indent}      <ManualMin>-0.5</ManualMin>
${indent}      <Name>Time Axis</Name>
${indent}      <Orientation>X</Orientation>
${indent}      <ScalingMode>MinMax</ScalingMode>
${indent}      <ShowAbsoluteTimes>None</ShowAbsoluteTimes>
${indent}      <SortPriority>100</SortPriority>
${indent}      <SubMember>
${indent}        <AxisStyle AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}          <ChannelRelatedGuid>00000000-0000-0000-0000-000000000000</ChannelRelatedGuid>
${indent}          <ColorMode>CustomColor</ColorMode>
${indent}          <Comment />
${indent}          <DisplayColor>-14803426</DisplayColor>
${indent}          <Grid>true</Grid>
${indent}          <GridColor>-14803426</GridColor>
${indent}          <GridDivisions>10</GridDivisions>
${indent}          <GridLineWidth>1</GridLineWidth>
${indent}          <Guid>${generateGuid()}</Guid>
${indent}          <LineWidth>1</LineWidth>
${indent}          <Name>Axis Style</Name>
${indent}          <Precision>10</Precision>
${indent}          <ShowName>False</ShowName>
${indent}          <ShowUnit>None</ShowUnit>
${indent}          <SortPriority>100</SortPriority>
${indent}          <SubGrid>false</SubGrid>
${indent}          <SubGridDivisions>5</SubGridDivisions>
${indent}          <Title>MeasurementMemberBase</Title>
${indent}          <UseScientificNotation>true</UseScientificNotation>
${indent}          <Visible>true</Visible>
${indent}        </AxisStyle>
${indent}      </SubMember>
${indent}      <Title>Time Axis</Title>
${indent}    </TimeAxis>
${indent}    <ValueAxis AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}      <Comment />
${indent}      <DisplayColor>Black</DisplayColor>
${indent}      <Guid>${generateGuid()}</Guid>
${indent}      <Inverted>false</Inverted>
${indent}      <Logarithmic>false</Logarithmic>
${indent}      <ManualMax>0.5</ManualMax>
${indent}      <ManualMin>-0.5</ManualMin>
${indent}      <Name>Value Axis</Name>
${indent}      <Orientation>Y</Orientation>
${indent}      <ScalingMode>AutoGrowOnly</ScalingMode>
${indent}      <SortPriority>100</SortPriority>
${indent}      <SubMember>
${indent}        <AxisStyle AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}          <ChannelRelatedGuid>00000000-0000-0000-0000-000000000000</ChannelRelatedGuid>
${indent}          <ColorMode>CustomColor</ColorMode>
${indent}          <Comment />
${indent}          <DisplayColor>-14803426</DisplayColor>
${indent}          <Grid>true</Grid>
${indent}          <GridColor>-14803426</GridColor>
${indent}          <GridDivisions>10</GridDivisions>
${indent}          <GridLineWidth>1</GridLineWidth>
${indent}          <Guid>${generateGuid()}</Guid>
${indent}          <LineWidth>1</LineWidth>
${indent}          <Name>Axis Style</Name>
${indent}          <Precision>10</Precision>
${indent}          <ShowName>False</ShowName>
${indent}          <ShowUnit>AllChannels</ShowUnit>
${indent}          <SortPriority>100</SortPriority>
${indent}          <SubGrid>false</SubGrid>
${indent}          <SubGridDivisions>5</SubGridDivisions>
${indent}          <Title>MeasurementMemberBase</Title>
${indent}          <UseScientificNotation>true</UseScientificNotation>
${indent}          <Visible>true</Visible>
${indent}        </AxisStyle>
${indent}      </SubMember>
${indent}      <Title>Value Axis</Title>
${indent}    </ValueAxis>
${indent}    <MarkerContainer AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}      <Comment />
${indent}      <DisplayColor>Black</DisplayColor>
${indent}      <Guid>${generateGuid()}</Guid>
${indent}      <Name>Marker Container</Name>
${indent}      <SortPriority>100</SortPriority>
${indent}      <SubMember />
${indent}      <Title>MeasurementMemberBase</Title>
${indent}    </MarkerContainer>
${channelsXml}
${indent}  </SubMember>
${indent}  <Title>${escapeXml(agAcq.axisGroup.name)}</Title>
${indent}</AxisGroup>`
}

/**
 * Generate YTChart XML containing all axis groups
 */
function generateYTChartXml(axisGroupAcquisitions: AxisGroupAcquisitions[], chartGuid: string, indent: string): string {
  const axisGroupsXml = axisGroupAcquisitions
    .map((agAcq, i) => generateAxisGroupXml(agAcq, 10 + i, `${indent}    `))
    .join('\n')

  return `${indent}<YTChart AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}  <AnchorTimestamp>0</AnchorTimestamp>
${indent}  <AssignedCore>0</AssignedCore>
${indent}  <AutoStart>true</AutoStart>
${indent}  <Comment />
${indent}  <ConnectedTimeMemberGuid>00000000-0000-0000-0000-000000000000</ConnectedTimeMemberGuid>
${indent}  <DefaultDisplayWidth>100000000</DefaultDisplayWidth>
${indent}  <DisplayColor>-1118478</DisplayColor>
${indent}  <DisplayOverwriteMode>false</DisplayOverwriteMode>
${indent}  <DurationLength>0</DurationLength>
${indent}  <ForeColor>-14803426</ForeColor>
${indent}  <Guid>${chartGuid}</Guid>
${indent}  <LayerEndConnectedTimeMemberGuid>00000000-0000-0000-0000-000000000000</LayerEndConnectedTimeMemberGuid>
${indent}  <LayerEndTimeRefreshMode>NoTime</LayerEndTimeRefreshMode>
${indent}  <LayerEndTimestamp>0</LayerEndTimestamp>
${indent}  <LayerEndTriggerGroupOffset>0</LayerEndTriggerGroupOffset>
${indent}  <LayerLength>0</LayerLength>
${indent}  <MasterChart>00000000-0000-0000-0000-000000000000</MasterChart>
${indent}  <Name>YT Chart</Name>
${indent}  <ShowImageChart>false</ShowImageChart>
${indent}  <SortPriority>10</SortPriority>
${indent}  <SubMember>
${indent}    <OverviewChart AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}      <Comment />
${indent}      <DisplayColor>-657931</DisplayColor>
${indent}      <ForeColor>-14803426</ForeColor>
${indent}      <Guid>${generateGuid()}</Guid>
${indent}      <Name>Overview Chart</Name>
${indent}      <OverviewVisible>false</OverviewVisible>
${indent}      <SortPriority>100</SortPriority>
${indent}      <Title>MeasurementMemberBase</Title>
${indent}    </OverviewChart>
${indent}    <ChartStyle AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}      <Comment />
${indent}      <DisplayColor>Black</DisplayColor>
${indent}      <GradientBackground>1</GradientBackground>
${indent}      <Guid>${generateGuid()}</Guid>
${indent}      <Name>Chart Style</Name>
${indent}      <ShowName>false</ShowName>
${indent}      <SortPriority>100</SortPriority>
${indent}      <StackedAxes>true</StackedAxes>
${indent}      <SubMember>
${indent}        <ChartZoomStyle AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}          <Comment />
${indent}          <DisplayColor>Black</DisplayColor>
${indent}          <Guid>${generateGuid()}</Guid>
${indent}          <Name>Chartzoom Style</Name>
${indent}          <ScaleOnZoom>true</ScaleOnZoom>
${indent}          <SortPriority>100</SortPriority>
${indent}          <Title>MeasurementMemberBase</Title>
${indent}          <YZoom>true</YZoom>
${indent}        </ChartZoomStyle>
${indent}        <ChartMenuStyle AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}          <ButtonSize>
${indent}            <Height>16</Height>
${indent}            <Width>16</Width>
${indent}          </ButtonSize>
${indent}          <Comment />
${indent}          <DisplayColor>Black</DisplayColor>
${indent}          <EnabledButtons>RunButton PauseButton Splitter1 DisplaywidthTextBox Splitter2 ScrollBackBig ScrollBackSmall ScrollForwardSmall ScrollForwardBig Splitter3 PositionTextBox Splitter4 UndoButton RedoButton Splitter5 PanXButton PanXYButton ZoomXButton ZoomXYButton UnzoomButton ZoomOutMaxButton OverviewButton CopyToClipboard OpenCurveCreatorButton</EnabledButtons>
${indent}          <EnabledTimeLabels>All</EnabledTimeLabels>
${indent}          <Guid>${generateGuid()}</Guid>
${indent}          <IndexNavigation>false</IndexNavigation>
${indent}          <Name>Chartmenu Style</Name>
${indent}          <SortPriority>100</SortPriority>
${indent}          <TimeStripFontSize>8.25</TimeStripFontSize>
${indent}          <Title>MeasurementMemberBase</Title>
${indent}          <ToolStripFontSize>8.25</ToolStripFontSize>
${indent}          <UseLongTimeFormat>true</UseLongTimeFormat>
${indent}          <VisibleTimeStrip>true</VisibleTimeStrip>
${indent}          <VisibleToolStrip>true</VisibleToolStrip>
${indent}        </ChartMenuStyle>
${indent}      </SubMember>
${indent}      <Title>MeasurementMemberBase</Title>
${indent}      <ToolTipEnabled>true</ToolTipEnabled>
${indent}    </ChartStyle>
${indent}    <MarkerContainer AssemblyName="TwinCAT.Measurement.Scope.API.Model">
${indent}      <Comment />
${indent}      <DisplayColor>Black</DisplayColor>
${indent}      <Guid>${generateGuid()}</Guid>
${indent}      <Name>Marker Container</Name>
${indent}      <SortPriority>100</SortPriority>
${indent}      <SubMember />
${indent}      <Title>MeasurementMemberBase</Title>
${indent}    </MarkerContainer>
${axisGroupsXml}
${indent}  </SubMember>
${indent}  <TimeOffset>0</TimeOffset>
${indent}  <TimeRefreshMode>Explicit</TimeRefreshMode>
${indent}  <Title>MeasurementMemberBase</Title>
${indent}  <TriggerGroupOffset>0</TriggerGroupOffset>
${indent}</YTChart>`
}

/**
 * Generate complete tcscopex XML content
 */
export function generateTcscopexXml(
  globalSettings: GlobalSettings,
  axisGroupAcquisitions: AxisGroupAcquisitions[]
): string {
  const projectGuid = generateGuid()
  const dataPoolGuid = generateGuid()
  const chartGuid = generateGuid()
  const windowGuid = chartGuid // YTChart guid is used as the window guid in the layout
  const containerGuid = generateGuid()

  // Flatten all acquisitions for the DataPool
  const allAcquisitions = axisGroupAcquisitions.flatMap((ag) => ag.acquisitions)
  const acquisitionsXml = allAcquisitions
    .map((acq) => generateAdsAcquisitionXml(acq))
    .join('\n')

  // Generate YTChart with axis groups
  const ytChartXml = generateYTChartXml(axisGroupAcquisitions, chartGuid, '    ')

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
${ytChartXml}
  </SubMember>
  <SynchronisationMode>Default</SynchronisationMode>
  <TargetConnectionIds />
  <Title>MeasurementMemberBase</Title>
  <UseAutoSave>false</UseAutoSave>
  <UseFileStore>true</UseFileStore>
  <Version>1.0.0.6</Version>
  <ViewDetailLevel>Default</ViewDetailLevel>
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
    if (scopeFile.axisGroups.length === 0) continue

    const fileName = `${scopeFile.name}.tcscopex`

    // Generate acquisitions grouped by axis group
    const axisGroupAcquisitions: AxisGroupAcquisitions[] = []

    for (const axisGroup of scopeFile.axisGroups) {
      const acquisitions: AdsAcquisition[] = []
      for (const pattern of axisGroup.patterns) {
        acquisitions.push(...generateAcquisitionsFromPattern(pattern, globalSettings))
      }
      if (acquisitions.length > 0) {
        axisGroupAcquisitions.push({ axisGroup, acquisitions })
      }
    }

    if (axisGroupAcquisitions.length === 0) continue

    const totalAcquisitions = axisGroupAcquisitions.reduce((sum, ag) => sum + ag.acquisitions.length, 0)
    const content = generateTcscopexXml(globalSettings, axisGroupAcquisitions)

    files.push({
      fileName,
      content,
      acquisitionCount: totalAcquisitions,
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
