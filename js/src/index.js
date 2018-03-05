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

const amsProtocols = {
  testbuttonService: (session) => {
    return {
      testbutton: () => {
        console.log("hi there ******************");
        session.call('amsprotocol.testbutton',[])
          .then((result) => log('result: ' + result));
      },
    };
  },
};

smartConnect.onConnectionReady((connection) => {
  const pvwClient =
        ParaViewWebClient.createClient(connection,
                                       [
                                         'MouseHandler',
                                         'ViewPort',
                                         'ViewPortImageDelivery',
                                       ],);
                                       //amsProtocols);
  const renderer = new RemoteRenderer(pvwClient);
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
divTitle.innerHTML = '<h1>Hello Amgen1234 World..!&nbsp;</h1>';

document.body.style.padding = '50';
document.body.style.margin = '50';

const divRoot = document.createElement('div');
divRoot.id = "root";
document.body.appendChild(divRoot);

class AMSControlPanel extends React.Component {
  testbutton() {
    smartConnect.getSession().call('amsprotocol.testbutton', [])
      .then((result) => console.log('result' + result));
    console.log("******* pressed test *******");
  };

  showVelocity() {
    smartConnect.getSession().call('amsprotocol.show.velocity', [])
      .then((result) => console.log('result' + result));
    console.log("******* pressed velocity *******");
  };

  showPressure() {
    smartConnect.getSession().call('amsprotocol.show.pressure', [])
      .then((result) => console.log('result' + result));
    console.log("******* pressed pressure *******");
  };

  showTankGeometry() {
    smartConnect.getSession().call('amsprotocol.show.tank.geometry', [])
      .then((result) => console.log('result' + result));
    console.log("******* pressed tankgeometry *******");
  };

  render() {
    return (<center>
            <button onClick={() => this.testbutton()}>chcolor</button>
            <button onClick={() => this.showVelocity()}>velocity</button>
            <button onClick={() => this.showPressure()}>pressure</button>
            <button onClick={() => this.showTankGeometry()}>tank</button>
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

ReactDOM.render(<AMSControlPanel />,
                document.getElementById('root'));

smartConnect.connect();

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

//                                                HTH,

