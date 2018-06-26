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

// We re-render the plots at a regular interval, need it or not, to
// accommodate whatever choice the user has made recently.  It all
// works fine with this value set to 5000 (milliseconds), but it isn't
// very responsive.  Make a lower value for better response, but also
// more CPU usage.
setInterval(next, 2000);

next();

