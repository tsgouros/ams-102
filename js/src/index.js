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


ReactDOM.render(<h1>Hello Parav0000011223445 World..!</h1>,
    document.getElementById('app'));

document.body.style.padding = '50';
document.body.style.margin = '50';

const divRenderer = document.createElement('div');
document.body.appendChild(divRenderer);

divRenderer.style.position = 'relative';
divRenderer.style.width = '100vw';
divRenderer.style.height = '100vh';
divRenderer.style.overflow = 'hidden';

const config = { sessionURL: 'ws://localhost:1234/ws' };
const smartConnect = SmartConnect.newInstance({ config });
smartConnect.onConnectionReady((connection) => {
  const pvwClient = ParaViewWebClient.createClient(connection, [
    'MouseHandler',
    'ViewPort',
    'ViewPortImageDelivery',
  ]);
  const renderer = new RemoteRenderer(pvwClient);
  renderer.setContainer(divRenderer);
  renderer.onImageReady(() => {
    console.log('We are good');
  });
  window.renderer = renderer;
  SizeHelper.onSizeChange(() => {
    renderer.resize();
  });
  SizeHelper.startListening();
});
smartConnect.connect();
