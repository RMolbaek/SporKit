/** Fiktiv linjeføring i ETRS89/UTM32 + DVR90 med klotoider, længdeprofil og overhøjde – til at prøve IFC-modulet. */
export const EKSEMPEL_LANDXML = `<?xml version="1.0" encoding="UTF-8"?>
<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2" date="2026-11-27" time="12:00:00">
 <Units><Metric areaUnit="squareMeter" linearUnit="meter" volumeUnit="cubicMeter" temperatureUnit="celsius" pressureUnit="milliBars" angularUnit="decimal degrees" directionUnit="decimal degrees"/></Units>
 <CoordinateSystem name="ETRS89 / UTM zone 32N" epsgCode="25832" horizontalCoordinateSystemName="ETRS89 / UTM zone 32N" verticalDatum="DVR90"/>
 <Alignments name="SporKit-eksempel">
  <Alignment name="Eksempel – fiktiv linjeføring" staStart="5000" length="1560.0">
   <CoordGeom>
    <Line staStart="5000.0000" length="200"><Start>6150000.0000 575000.0000</Start><End>6150100.0000 575173.2051</End></Line>
    <Spiral rot="ccw" staStart="5200.0000" length="120" radiusStart="INF" radiusEnd="1000" spiType="clothoid"><Start>6150100.0000 575173.2051</Start><PI>6150140.0075 575242.5002</PI><End>6150162.0563 575275.8910</End></Spiral>
    <Curve rot="ccw" staStart="5320.0000" length="300" radius="1000" crvType="arc"><Start>6150162.0563 575275.8910</Start><Center>6150996.5414 574724.8604</Center><End>6150362.1680 575497.8873</End></Curve>
    <Spiral rot="ccw" staStart="5620.0000" length="120" radiusStart="1000" radiusEnd="INF" spiType="clothoid"><Start>6150362.1680 575497.8873</Start><PI>6150393.0997 575523.2709</PI><End>6150457.8860 575570.2300</End></Spiral>
    <Line staStart="5740.0000" length="150"><Start>6150457.8860 575570.2300</Start><End>6150579.3373 575658.2617</End></Line>
    <Spiral rot="cw" staStart="5890.0000" length="80" radiusStart="INF" radiusEnd="600" spiType="clothoid"><Start>6150579.3373 575658.2617</Start><PI>6150622.5300 575689.5691</PI><End>6150643.0395 575706.6300</End></Spiral>
    <Curve rot="cw" staStart="5970.0000" length="200" radius="600" crvType="arc"><Start>6150643.0395 575706.6300</Start><Center>6150259.3319 576167.8984</Center><End>6150772.8436 575857.5667</End></Curve>
    <Spiral rot="cw" staStart="6170.0000" length="80" radiusStart="600" radiusEnd="INF" spiType="clothoid"><Start>6150772.8436 575857.5667</Start><PI>6150786.6420 575880.3991</PI><End>6150811.1307 575927.7919</End></Spiral>
    <Line staStart="6250.0000" length="100"><Start>6150811.1307 575927.7919</Start><End>6150857.0362 576016.6327</End></Line>
    <Curve rot="cw" staStart="6350.0000" length="60" radius="220" crvType="arc"><Start>6150857.0362 576016.6327</Start><Center>6150661.5866 576117.6249</Center><End>6150877.0156 576073.0114</End></Curve>
    <Line staStart="6410.0000" length="150"><Start>6150877.0156 576073.0114</Start><End>6150907.4339 576219.8948</End></Line>
   </CoordGeom>
   <Profile name="Spor 1">
    <ProfAlign name="SO">
     <PVI>5000 20.000</PVI>
     <ParaCurve length="120">5400 24.000</ParaCurve>
     <CircCurve length="36.4" radius="5000">5900 21.500</CircCurve>
     <PVI>6560.000 23.000</PVI>
    </ProfAlign>
   </Profile>
   <Cant name="Overhøjde" gauge="1.435" rotationPoint="insideRail">
    <CantStation station="5200" appliedCant="0" curvature="ccw"/>
    <CantStation station="5320" appliedCant="0.090" curvature="ccw"/>
    <CantStation station="5620" appliedCant="0.090" curvature="ccw"/>
    <CantStation station="5740" appliedCant="0" curvature="ccw"/>
    <CantStation station="5890" appliedCant="0" curvature="cw"/>
    <CantStation station="5970" appliedCant="0.120" curvature="cw"/>
    <CantStation station="6170" appliedCant="0.120" curvature="cw"/>
    <CantStation station="6250" appliedCant="0" curvature="cw"/>
   </Cant>
  </Alignment>
 </Alignments>
</LandXML>
`;
