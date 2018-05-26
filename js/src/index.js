import 'normalize.css';

import { debounce } from 'paraviewweb/src/Common/Misc/Debounce';

import VtkRenderer from 'paraviewweb/src/NativeUI/Renderers/VtkRenderer';
import SizeHelper from 'paraviewweb/src/Common/Misc/SizeHelper';
import ParaViewWebClient from 'paraviewweb/src/IO/WebSocket/ParaViewWebClient';

import React from 'react';
import ReactDOM from 'react-dom';


import AMSPlot from './AMSPlot';

const AMSConfig = { sessionURL: 'ws://localhost:1234/ws' };

// To create a visualization, you need a recipe (what kind of plot, what
// variables, what colors, etc) and some data to which it is to be applied.
// We will proceed by creating a cookbook of such recipes over here on the
// client side and a catalog of available data over there on the server.
// (It might eventually be that the cookbook is seeded from a server-side
// cache, but during a session, the authoritative version is on the client.)
//


// A list of data names and some descriptive information about each data
// source.  The authoritative copy is over on the server side, but we keep a
// copy over here to help populate the dialogs.
var dataCatalog = {
  m100rpm: {
    fileName: "100rpm.encas",
    variables: {
      pressure: "pressure",
      uds_0_scalar: "uds_0_scalar",
      axial_velocity: "axial_velocity",
      radial_velocity: "radial_velocity",
      tangential_velocit: "tangential_velocity",
    }
  },
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
const AMSProtocols = {
  amsService: (session) => {
    return {

      showTankGeometry: ( view ) => {
        session.call('amsprotocol.show.tank.geometry', [ view ])
          .then((result) => console.log('result', result));
        console.log("******* pressed tankgeometry *******");
      },

      clearAll: ( view ) => {
        session.call('amsprotocol.clear.all', [ view ])
          .then((result) => console.log('result', result));
        console.log("******* pressed clear all *******");
      },

      executeViz: (view, value) => {
        session.call('amsprotocol.execute.viz', [ view, value ])
          .then((result) => console.log('result: ' + result));
        console.log("******* execute viz ------>", view, value, "<<<");
      },

      getDataCatalog: () => {
        session.call('amsprotocol.get.data.catalog', [])
          .then((result) => {
            console.log('catalog result: ', result);
            dataCatalog = result;
          });
        console.log("******* get data catalog ------<<<");
      },

      testButton: (testValue) => {
        session.call('amsprotocol.test.button', [ testValue ])
          .then((result) => {
            console.log('result: ', result.hello);
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


const divTitle = document.createElement('div');
divTitle.id = "divTitle";
document.body.appendChild(divTitle);
divTitle.innerHTML = '<h1>&nbsp;&nbsp;&nbsp;Hello Amgen World!</h1>';

const divRoot = document.createElement('div');
divRoot.id = "root";
document.body.appendChild(divRoot);

document.body.style.padding = '50';
document.body.style.margin = '50';

function next() {
  console.log("hi there, about to call render");
  ReactDOM.render(<AMSPlot
                     dataCatalog={dataCatalog}
                     config={AMSConfig}
                     protocols={AMSProtocols}
                  />,
                  document.getElementById('root'));
};

// This may not be necessary, but for some configurations making sure to
// re-render every now and then, need it or not, is a good idea.  Test to
// find out.
setInterval(next, 5000);

next();

// TODO:
//
// - Conditional rendering of visualization editor dialog.
//
// - Get plot possibilities from server (data catalog, plot varieties,
//   variables that can be displayed, etc.)
//
// - Move renderer down a level so that it's all inside a single React
// - component that encompasses the canvas and the draw dialog.
//
// - Can we put a second render window in place?
//
// - Can we control the rotation and view of the second window from the first?
//
//
