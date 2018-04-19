import 'normalize.css';

import Workbench from 'paraviewweb/src/Component/Native/Workbench';
import ToggleControl from 'paraviewweb/src/Component/Native/ToggleControl';
import BGColor from 'paraviewweb/src/Component/Native/BackgroundColor';
import Spacer from 'paraviewweb/src/Component/Native/Spacer';
import Composite from 'paraviewweb/src/Component/Native/Composite';
import ReactAdapter from 'paraviewweb/src/Component/React/ReactAdapter';
import WorkbenchController from 'paraviewweb/src/Component/React/WorkbenchController';
import NumberSliderWidget from 'paraviewweb/src/React/Widgets/NumberSliderWidget';

import { debounce } from 'paraviewweb/src/Common/Misc/Debounce';

//import RemoteRenderer from 'paraviewweb/src/NativeUI/Canvas/RemoteRenderer';
import VtkRenderer from 'paraviewweb/src/NativeUI/Renderers/VtkRenderer';
import SizeHelper from 'paraviewweb/src/Common/Misc/SizeHelper';
import ParaViewWebClient from 'paraviewweb/src/IO/WebSocket/ParaViewWebClient';

import React from 'react';
import ReactDOM from 'react-dom';

import SmartConnect from 'wslink/src/SmartConnect';

import PlotDialog from './PlotDialog';

const config = { sessionURL: 'ws://localhost:1234/ws' };
const smartConnect = SmartConnect.newInstance({ config });

const model = {};
let connectionReady = false;

// This is meant to hold all the variable aspects of a plot *except* the data
// source (e.g. file name, whatever).  The point is to be able to apply this
// visualization to whatever data is in the catalog.
class plotParams {
  constructor(plotType, variable) {
    this.plotType = plotType;
    this.variable = variable;
  }
}

// This will be an association of names and plotParam objects.
const plotCatalog = {}

function generateCatalogSpec() {
  console.log("calling catalogSpec:", plotCatalog, Object.keys(plotCatalog));

  if (Object.keys(plotCatalog).length === 0 &&
      plotCatalog.constructor === Object) {
    return [
      {
        name: "plotName",
        widgetType: "enum",
        vals: ["no plots stored"],
        selected: "no plots stored",
        dataType: "string",
        id: "plotName",
        help: "Select a plot by name."          
      }
    ]
  } else {
    return [
      {
        name: "plotName",
        widgetType: "enum",
        vals: () => { return Object.keys(plotCatalog); },
        selected: "no plots",
        dataType: "string",
        id: "plotName",
        help: "Select a plot by name."
      }
    ]
  }
}



const amsProtocols = {
  amsService: (session) => {
    return {
      drawLowRPM: () => {
        session.call('amsprotocol.draw.low.rpm', [])
          .then((result) => console.log('result: ' + result));
        console.log("******* pressed low rpm *******");
      },

      drawHighRPM: () => {
        session.call('amsprotocol.draw.high.rpm', [])
          .then((result) => console.log('result: ' + result));
        console.log("******* pressed high rpm *******");
      },

      showTankGeometry: () => {
        session.call('amsprotocol.show.tank.geometry', [])
          .then((result) => console.log('result' + result));
        console.log("******* pressed tankgeometry *******");
      },

      clearAll: () => {
        session.call('amsprotocol.clear.all', [])
          .then((result) => console.log('result' + result));
        console.log("******* pressed clear all *******");
      },

      changeSurface: (surfaceValue) => {
        session.call('amsprotocol.change.surface', [ surfaceValue ])
          .then((result) => console.log('result: ' + result));
        console.log("******* adjusted number of sides ********");
      },

      executePlot: (value) => {
        session.call('amsprotocol.execute.plot', [ value ])
          .then((result) => console.log('result: ' + result));
        console.log("******* testbutton ------>", value);
      },

      testButton: (testValue) => {
        session.call('amsprotocol.test.button', [ testValue ])
          .then((result) => console.log('result: ' + result.hello));
        console.log("******* testbutton ------>", testValue);
      },

      heartbeatUpdate: () => {
        session.call('amsprotocol.heartbeat.update');
      },
    };
  },
};

smartConnect.onConnectionReady((connection) => {
  model.pvwClient =
    ParaViewWebClient.createClient(connection,
                                   [
                                     'MouseHandler',
                                     'ViewPort',
                                     'VtkImageDelivery',
                                   ],
                                   amsProtocols);
  const renderer = VtkRenderer.newInstance({ client: model.pvwClient });
  renderer.setContainer(divRenderer);
  // renderer.onImageReady(() => {
  //   console.log('image ready (for next command)');
  // });
  window.renderer = renderer;
  SizeHelper.onSizeChange(() => {
    renderer.resize();
  });
  SizeHelper.startListening();
  connectionReady = true;
});

const divTitle = document.createElement('div');
document.body.appendChild(divTitle);
divTitle.innerHTML = '<h1>&nbsp;&nbsp;&nbsp;Hello Amgen World!</h1>';

document.body.style.padding = '50';
document.body.style.margin = '50';

const divPreRoot = document.createElement('div');
divPreRoot.id = "preRoot";
document.body.appendChild(divPreRoot);

const divRoot = document.createElement('div');
divRoot.id = "root";
document.body.appendChild(divRoot);

class AMSControlPanel extends React.Component {
  constructor(props) {
    super(props);
    console.log("AMSControlPanel:", props);

    this.state = {
      plotType: "isosurface",
      surfaceValue: 500
    };
    this.updateSliderVal = this.updateSliderVal.bind(this);
    this.dialogSpec = this.dialogSpec.bind(this);
    this.returnDialogState = this.returnDialogState.bind(this);
    this.props.updateCatalogSpec();
  }

  returnDialogState(p) {
    console.log("returned value:", p);
    plotCatalog[p.CellPlotName.value[0]] = p;
    console.log("plotCatalog:", plotCatalog);
    model.pvwClient.amsService.executePlot(p);
  }

  returnCatalogState(p) {
    console.log("returned catalog value:", p);
  }
  
  updateSliderVal(e) {
    // What changes, and what value?
    const which = e.target.name;
    const newVal = e.target.value;
    const toUpdateSlider = {};
    toUpdateSlider[which] = newVal;

    // Update the new value in the display.
    this.setState(toUpdateSlider);

    console.log(typeof e.target.value);
    // Communicate it to the server.
    model.pvwClient.amsService.changeSurface(e.target.value);
  }

  catalogSpec() { return generateCatalogSpec(); }
  
  dialogSpec() {
    return [
      {
        name: "plotName",
        widgetType: "cell",
        vals: [],
        selected: ["plot name"],
        id: "CellPlotName",
        dataType: "string",
        help: "Give this collection of plot parameters a name so you can use it again.",
      },
      {
        name: "plotType",
        widgetType: "enum",
        vals: ["contour", "streamlines"],  // the list of possible values
        selected: "contour",      // the current value
        id: "EnumPlotType",      // just has to be unique in this list
        dataType: "string",           // 'string' or 'int'
        help: "Choose the type of plot to view.",
      },
      {
        name: "contour variable",
        widgetType: "enum",
        vals: ["uds_0_scalar",
               "pressure",
               "axial_velocity",
               "radial_velocity",
               "tangential_velocity"
              ],
        selected: "uds_0_scalar",
        id: "EnumContourVariable",
        dataType: "string",
        help: "Which value to contour?",
      },
      {
        name: "contour value",
        widgetType: "cell",
        vals: [0.0, 800.0],
        selected: [400.0],
        id: "DoubleContourValue",
        dataType: "double",
        help: "Select a contour value",
      },
      {
        name: "color variable",
        widgetType: "enum",
        vals: ["pressure",
               "uds_0_scalar",
               "axial_velocity",
               "radial_velocity",
               "tangential_velocity"
              ],
        selected: "pressure",
        id: "EnumColorVariable",
        dataType: "string",
        help: "Which variable to color the contour or streamline?",
      },
      // {
      //   name: "contour value",
      //   widgetType: "slider",
      //   vals: [0.0, 800.0],
      //   selected: [400.0],
      //   id: "DoubleContourValue",
      //   dataType: "double",
      //   help: "Select a contour value",
      // },
      // {
      //   name: "some other value",
      //   widgetType: "cell",
      //   vals: [0, 1],
      //   selected: [0.5],
      //   id: "CellValue",
      //   dataType: "double",
      //   help: "A little help text...",
      // },
      // {
      //   name: "still another value",
      //   widgetType: "cell",
      //   vals: [0, 10],
      //   selected: [5],
      //   id: "CellValue2",
      //   dataType: "int",
      //   help: "A little help text...",
      // },
    ];
  }
    
  render() {
    const [surfaceValue] = [this.state.surfaceValue];
    //console.log("in render: ", plotCatalog, this.catalogSpec);
    
    return (
        <center>
        <div style={{width: '100%', display: 'table'}}>
        <PlotDialog deliverDialogSpec={this.dialogSpec}
                    returnDialogResults={this.returnDialogState}/>        
        <PlotDialog deliverDialogSpec={this.catalogSpec}
                    returnDialogResults={this.returnCatalogState}/>        
        <div style={{display: 'table-cell'}}>
        <button onClick={() => model.pvwClient.amsService.testButton(testVal)}>test</button>
        <button onClick={() => model.pvwClient.amsService.drawLowRPM()}>low rpm</button>
        <button onClick={() => model.pvwClient.amsService.drawHighRPM()}>high rpm</button>
        <button onClick={() => model.pvwClient.amsService.showTankGeometry()}>tank</button>
        <button onClick={() => model.pvwClient.amsService.clearAll()}>clear</button>
        </div>
        <div style={{display: 'table-cell'}}>
        <NumberSliderWidget value={surfaceValue}
            max="1000" min="10" onChange={this.updateSliderVal} name="surfaceValue"/>
        </div>
        </div>

        </center>
    );
  }
}

const divRenderer = document.createElement('div');
document.body.appendChild(divRenderer);

divRenderer.style.position = 'relative';
divRenderer.style.width = '100vw';
divRenderer.style.height = '100vh';
divRenderer.style.overflow = 'hidden';
divRenderer.style.zIndex = '10';

smartConnect.connect();

const testVal = {hello: 52.6};

function ucs() {
  console.log("is this how it works?");
}

function next() {
//  console.log("hi there", plotCatalog);
  ReactDOM.render(<AMSControlPanel updateCatalogSpec={ucs}/>,
                  document.getElementById('root'));
  // ReactDOM.render(<PlotDialog />,
  //                 document.getElementById('preRoot'));
};

setInterval(next, 5000);
setInterval(function() {
  if (connectionReady) {
    model.pvwClient.amsService.heartbeatUpdate();
  };
},1000);

next();

// The array list should only contain the names that belong to that directory:
// https://github.com/Kitware/paraviewweb/tree/master/src/IO/WebSocket/ParaViewWebClient

// Then your custom protocol should looks like:
// https://github.com/Kitware/paraviewweb/blob/master/src/IO/WebSocket/ParaViewWebClient/ProxyManager.js

// Except that you will need to nest it inside an object like:

// {
//   CustomProtocol1: [...content of the previous example...],
//   CustomProtocol2: [...content of the previous example...],
// }

// Then to use it you will do:

// client.CustomProtocol1.availableSources().then(...

// You can find a live example of its usage here:
// https://github.com/Kitware/divvy/blob/master/Sources/client.js#L27-L65

// TODO:
//
// - The method of invoking the protocols is not ideal, so let's try
//   the above.
//
// - Can we put a second render window in place?
//
// - Can we control the rotation and view?
//
//
