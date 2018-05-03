import 'normalize.css';

import Workbench from 'paraviewweb/src/Component/Native/Workbench';
import ToggleControl from 'paraviewweb/src/Component/Native/ToggleControl';
import BGColor from 'paraviewweb/src/Component/Native/BackgroundColor';
import Spacer from 'paraviewweb/src/Component/Native/Spacer';
import Composite from 'paraviewweb/src/Component/Native/Composite';
import ReactAdapter from 'paraviewweb/src/Component/React/ReactAdapter';
import WorkbenchController from 'paraviewweb/src/Component/React/WorkbenchController';

import { debounce } from 'paraviewweb/src/Common/Misc/Debounce';

//import RemoteRenderer from 'paraviewweb/src/NativeUI/Canvas/RemoteRenderer';
import VtkRenderer from 'paraviewweb/src/NativeUI/Renderers/VtkRenderer';
import SizeHelper from 'paraviewweb/src/Common/Misc/SizeHelper';
import ParaViewWebClient from 'paraviewweb/src/IO/WebSocket/ParaViewWebClient';

import React from 'react';
import ReactDOM from 'react-dom';

import SmartConnect from 'wslink/src/SmartConnect';

import AMSControlPanel from './AMSControlPanel';

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

// This will be an association of names and descriptions of visualizations.
//var vizCatalog = {emptyPlot: {plot: "whatever"}};
var vizCatalog = {
  "plot name": {
    EnumPlotType:  "contour",
    EnumContourVariable:  "uds_0_scalar",
    DoubleContourValue:  [400],
    EnumColorVariable: "pressure",
    CellPlotName: ["plot name"],
  }   
};

// A list of data names, meaningful over on the pvpython side, and
// descriptive data about each data source 
var dataCatalog = {
  m100rpm: {
    fileName: "100rpm.encas",
  },
  m250rpm: {
    fileName: "250rpm.encas",
  },
  m50rpm: {
    fileName: "50rpm.encas",
  }
};

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
        console.log("******* execute plot ------>", value, "<<<");
      },

      testButton: (testValue) => {
        session.call('amsprotocol.test.button', [ testValue ])
          .then((result) => {
            console.log('result: ' + result.hello);
            vizCatalog = result;
          });
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
  // Create a vtk renderer.
  const renderer = VtkRenderer.newInstance({ client: model.pvwClient });

  // Place it in the container set up for it.
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

function onDrawCommand(drawCommand) {
  console.log("onDrawCommand is to execute:", drawCommand);
};

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

const divRenderer = document.createElement('div');
document.body.appendChild(divRenderer);

divRenderer.style.position = 'relative';
divRenderer.style.width = '100vw';
divRenderer.style.height = '100vh';
divRenderer.style.overflow = 'hidden';
divRenderer.style.zIndex = '10';

smartConnect.connect();

function next() {
  //console.log("hi there", vizCatalog);
  ReactDOM.render(<AMSControlPanel model={model}
                  vizCatalog={vizCatalog}
                  dataCatalog={dataCatalog}
                  executeDrawCommand={onDrawCommand} />,
                  document.getElementById('root'));
};

//setInterval(next, 5000);
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
