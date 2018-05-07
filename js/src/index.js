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

// Create a SmartConnect object.
const config = { sessionURL: 'ws://localhost:1234/ws' };
const smartConnect = SmartConnect.newInstance({ config });

const model = {};
let connectionReady = false;

// To create a visualization, you need a recipe (what kind of plot, what
// variables, what colors, etc) and some data to which it is to be applied.
// We will proceed by creating a cookbook of such recipes over here on the
// client side and a catalog of available data over there on the server.
// (It might eventually be that the cookbook is seeded from a server-side
// cache, but during a session, the authoritative version is on the client.)
//
// A command to draw something contains a recipe and a data source.  The
// recipe, since it is defined on the client, is entirely contained in the
// draw command, while the data source is only named, with a reference to
// the list kept over on the server.
class drawCommand {
  constructor(drawRecipe, dataName) {
    // This will be a copy of an element from the vizCatalog.
    this.drawRecipe = drawRecipe;  
    this.dataName = dataName;
  }
}

// This is the visualization cookbook, a collection of visualization recipes
// that can be applied to the data sources.  It is a an association of names
// and descriptions of visualizations.  This is the authoritative copy,
// though there is (probably) also a copy on the server.
var vizCatalog = {
  "plot name": {
    EnumPlotType:  "contour",
    EnumContourVariable:  "uds_0_scalar",
    DoubleContourValue:  [400],
    EnumColorVariable: "pressure",
    CellPlotName: ["plot name"],
  }   
};

// A list of data names and some descriptive information about each data
// source.  The authoritative copy is over on the server side.
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

// This is the collection of RPC functions supported by the pvpython server.
// They are fed to the smartConnect function and returned as part of the
// pvwClient object, which is how they can be accessed henceforward.
//
// The 'session.call' method references a string that must appear verbatim
// on the server side.  Note that capital letters are NOT permitted, per
// some quirk in the wslink implementation.  There seems to be no limitation
// on the data types that can be passed.  JS objects wind up as Python dicts
// over there, for example.
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

// Establish where the SmartConnect object will be attached to the graphical
// display when it is created.
smartConnect.onConnectionReady((connection) => {
  // Attach the client to the global 'model' object so it can be referenced
  // elsewhere.
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

// This may not be necessary, but for some configurations making sure to
// re-render every now and then, need it or not, is a good idea.  Test to
// find out.
// setInterval(next, 5000);

// This function's purpose is to make the visualization canvas update when a
// parameter has been changed or the visualization changes.
setInterval(function() {
  if (connectionReady) {
    model.pvwClient.amsService.heartbeatUpdate();
  };
},1000);

next();

// TODO:
//
// - Hook up plot command and plotting apparatus.
//
// - Get plot possibilities from server (data catalog, plot varieties,
// - variables that can be displayed, etc.)
//
// - Move renderer down a level so that it's all inside a single React
// - component that encompasses the canvas and the draw dialog.
//
// - Can we put a second render window in place?
//
// - Can we control the rotation and view of the second window from the first?
//
//
