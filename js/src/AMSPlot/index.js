import React from 'react';
import VtkRenderer from 'paraviewweb/src/NativeUI/Renderers/VtkRenderer';
import SizeHelper from 'paraviewweb/src/Common/Misc/SizeHelper';
import ParaViewWebClient from 'paraviewweb/src/IO/WebSocket/ParaViewWebClient';

import AMSControlPanel from '../AMSControlPanel';
import AMSPlotDialog from '../AMSPlotDialog';

import SmartConnect from 'wslink/src/SmartConnect';

// This class controls a control panel and a plot.  The plot has a
// link to a render view object in the pvpython server, and the
// control panel takes care of what exactly is shown in the render
// view object.

class AMSPlot extends React.Component {
  constructor(props) {
    super(props);
    console.log("Constructing AMSPlot:", props);

    this.state = {
      dataCatalog: props.dataCatalog,
    };


    this.rendererOne = {};
    this.rendererTwo = {};

    // Create our 'smart connection' object using the config sent down
    // via props.
    const config = props.config;
    this.smartConnect = SmartConnect.newInstance({ config });
    console.log("in AMSPlot constructor:", props, this.smartConnect);

    this.model = {};
    this.connectionReady = false;

    // Establish where the SmartConnect object will be attached to the graphical
    // display when it is created.
    this.smartConnect.onConnectionReady((connection) => {
      // Attach the client to the global 'model' object so it can be referenced
      // elsewhere.
      console.log("connection ready");
      this.model.pvwClient =
        ParaViewWebClient.createClient(connection,
                                       [
                                         'MouseHandler',
                                         'ViewPort',
                                         'VtkImageDelivery',
                                       ],
                                       props.protocols);

      this.model.pvwClient.amsService.getRenderViewIDs();

      // Create a vtk renderer.
      this.rendererOne = VtkRenderer.newInstance({
        client: this.model.pvwClient,
        viewId: -1
      });
      this.rendererTwo = VtkRenderer.newInstance({
        client: this.model.pvwClient,
        viewId: -1
      });

      // Place it in the container set up for it.
      this.rendererOne.setContainer(document.getElementById("renderContainerOne"));
      this.rendererTwo.setContainer(document.getElementById("renderContainerTwo"));
      // renderer.onImageReady(() => {
      //   console.log('image ready (for next command)');
      // });

      SizeHelper.onSizeChange(() => {
        this.rendererOne.resize();
        this.rendererTwo.resize();
      });
      SizeHelper.startListening();
      this.connectionReady = true;

      console.log("connection ready, data returned:", this.model);
    });


    this.smartConnect.connect();

    // This function's purpose is to make the visualization canvas update when a
    // parameter has been changed or the visualization changes.
    setInterval(function() {
      if (this.connectionReady) {
        this.model.pvwClient.amsService.heartbeatUpdate();
      };
    },1000);

    this.onDrawCommandOne = this.onDrawCommandOne.bind(this);
    this.onDrawCommandTwo = this.onDrawCommandTwo.bind(this);

  }

  onDrawCommandOne() {
    if (this.props.viewIDList) {
      console.log("onDrawCommandOne is to execute.");
      this.model.pvwClient.amsService.executeViz(this.props.viewIDList[0]);
    } else {
      console.log("no view to draw with");
    }
  }

  onDrawCommandTwo() {
    if (this.props.viewIDList) {
      console.log("onDrawCommandTwo is to execute.");
      this.model.pvwClient.amsService.executeViz(this.props.viewIDList[1]);
    } else {
      console.log("no view to draw with");
    }
  }


  render() {
    console.log("rendering AMSPlot:", this.model);

    if (this.props.viewIDList.length > 1) {
      if (this.rendererOne.getViewId() < 0) {
        console.log("linking rendererOne to: ", this.props.viewIDList, 0);
        this.rendererOne.setViewId(Number(this.props.viewIDList[0]));
      }

      if (this.rendererTwo.getViewId() < 0) {
        console.log("linking rendererTwo to: ", this.props.viewIDList, 1);
        this.rendererTwo.setViewId(Number(this.props.viewIDList[1]));
      }
    };


//      <button onClick={() => this.rendererTwoVisible = !this.rendererTwoVisible}>Two</button>


    return (
        <div style={{ width: '100vw', display: 'table' }}>
        <div style={{display: 'table-row',
                     width: '100vw',
                    }}>
        <div style={{display: 'table-cell',
                     width: '50%',
                    }}>
        <button onClick={this.onDrawCommandOne}>Draw Cone</button>
            <div id="renderContainerOne"
                 style={{position: 'relative',
                         width: '100%',
                         height: '80vh',
                         overflow: 'hidden',
                         zIndex: '10',
                        }}
            />
          </div>
          <div style={{display: 'table-cell',
                       width: '50%',
                      }}>
        <button onClick={this.onDrawCommandTwo}>Draw Sphere</button>
            <div id="renderContainerTwo"
                 style={{position: 'relative',
                         width: '100%',
                         height: '80vh',
                         overflow: 'hidden',
                         zIndex: '10',
                        }}
            />
          </div>
       </div>
     </div>
    )
  }
}

export default AMSPlot;


