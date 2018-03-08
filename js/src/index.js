import 'normalize.css';

import Workbench from 'paraviewweb/src/Component/Native/Workbench';
import ToggleControl from 'paraviewweb/src/Component/Native/ToggleControl';
import BGColor from 'paraviewweb/src/Component/Native/BackgroundColor';
import Spacer from 'paraviewweb/src/Component/Native/Spacer';
import Composite from 'paraviewweb/src/Component/Native/Composite';
import ReactAdapter from 'paraviewweb/src/Component/React/ReactAdapter';
import WorkbenchController from 'paraviewweb/src/Component/React/WorkbenchController';
import { debounce } from 'paraviewweb/src/Common/Misc/Debounce';

import RemoteRenderer from 'paraviewweb/src/NativeUI/Canvas/RemoteRenderer';
import SizeHelper from 'paraviewweb/src/Common/Misc/SizeHelper';
import ParaViewWebClient from 'paraviewweb/src/IO/WebSocket/ParaViewWebClient';

import React from 'react';
import ReactDOM from 'react-dom';

import SmartConnect from 'wslink/src/SmartConnect';

const config = { sessionURL: 'ws://localhost:1234/ws' };
const smartConnect = SmartConnect.newInstance({ config });

var model = {};

const amsProtocols = {
  testButtonService: (session) => {
    return {
      testbutton: () => {
        session.call('amsprotocol.testbutton', [ "123" ])
          .then((result) => console.log('result: ' + result));
        console.log("******* pressed test *******");
      },

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

      showVelocity: () => {
        session.call('amsprotocol.show.velocity', [])
          .then((result) => console.log('result' + result));
        console.log("******* pressed velocity *******");
      },

      showPressure: () => {
        session.call('amsprotocol.show.pressure', [])
          .then((result) => console.log('result' + result));
        console.log("******* pressed pressure *******");
      },

      showTankGeometry: () => {
        session.call('amsprotocol.show.tank.geometry', [])
          .then((result) => console.log('result' + result));
        console.log("******* pressed tankgeometry *******");
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
                                     'ViewPortImageDelivery',
                                   ],
                                   amsProtocols);
  const renderer = new RemoteRenderer(model.pvwClient);
  renderer.setContainer(divRenderer);
  renderer.onImageReady(() => {
    console.log('image ready (for next command)');
  });
  window.renderer = renderer;
  SizeHelper.onSizeChange(() => {
    renderer.resize();
  });
  SizeHelper.startListening();
});

const divTitle = document.createElement('div');
document.body.appendChild(divTitle);
divTitle.innerHTML = '<h1>&nbsp;&nbsp;&nbsp;Hello Amgen World!</h1>';

document.body.style.padding = '50';
document.body.style.margin = '50';

const divRoot = document.createElement('div');
divRoot.id = "root";
document.body.appendChild(divRoot);

class AMSControlPanel extends React.Component {
  render() {
    return (
        <center>
        <button onClick={() => model.pvwClient.testButtonService.testbutton()}>test</button>
        <button onClick={() => model.pvwClient.testButtonService.drawLowRPM()}>low rpm</button>
        <button onClick={() => model.pvwClient.testButtonService.drawHighRPM()}>high rpm</button>
        <button onClick={() => model.pvwClient.testButtonService.showVelocity()}>velocity</button>
        <button onClick={() => model.pvwClient.testButtonService.showPressure()}>pressure</button>
        <button onClick={() => model.pvwClient.testButtonService.showTankGeometry()}>tank</button>
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

smartConnect.connect();

ReactDOM.render(<AMSControlPanel />,
                document.getElementById('root'));


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
