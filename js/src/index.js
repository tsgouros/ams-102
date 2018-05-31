import 'normalize.css';

import { debounce } from 'paraviewweb/src/Common/Misc/Debounce';

import VtkRenderer from 'paraviewweb/src/NativeUI/Renderers/VtkRenderer';
import SizeHelper from 'paraviewweb/src/Common/Misc/SizeHelper';
import ParaViewWebClient from 'paraviewweb/src/IO/WebSocket/ParaViewWebClient';

import React from 'react';
import ReactDOM from 'react-dom';


import AMSPlot from './AMSPlot';

const AMSConfig = { sessionURL: 'ws://localhost:1234/ws' };

const divTitle = document.createElement('div');
divTitle.id = "divTitle";
document.body.appendChild(divTitle);
divTitle.innerHTML = '<h1 style="height: 8vh; padding: 0px; margin: 0px">&nbsp;&nbsp;&nbsp;AMS-102</h1>';

const divRoot = document.createElement('div');
divRoot.id = "root";
document.body.appendChild(divRoot);

document.body.style.padding = '50';
document.body.style.margin = '50';

function next() {
  console.log("hi there, about to call render");
  ReactDOM.render(<AMSPlot
                     config={AMSConfig}
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
