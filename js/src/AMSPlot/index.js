import React from 'react';
import VtkRenderer from 'paraviewweb/src/NativeUI/Renderers/VtkRenderer';
import SizeHelper from 'paraviewweb/src/Common/Misc/SizeHelper';
import ParaViewWebClient from 'paraviewweb/src/IO/WebSocket/ParaViewWebClient';

import AMSControlPanel from '../AMSControlPanel';

import SmartConnect from 'wslink/src/SmartConnect';

// This class controls a control panel and a plot.  The plot has a
// link to a render view object in the pvpython server, and the
// control panel takes care of what exactly is shown in the render
// view object.

// Note to me: We need to move the render window and view *down* from
// the root level into this object.  And then we need to move the
// "Edit Plot Description" button *up* into this object.  After that,
// we can experiment with multiple render view canvas objects, which
// will happen by moving the "Edit Plot Description" button up one
// more level so there can multiples of this object while only having
// one of those.
//
// 1. Move render canvas from above down to here.
// 2. Move edit plot description from the control panel to this object.
// 3. Move edit plot description from this object to its parent.


class AMSPlot extends React.Component {
  constructor(props) {
    super(props);
    console.log("Constructing AMSPlot:", props);

    this.state = {
      dataCatalog: props.dataCatalog,
    };

    // This is the visualization cookbook, a collection of visualization recipes
    // that can be applied to the data sources.  It is a an association of names
    // and descriptions of visualizations.  This is the authoritative copy,
    // though there is (probably) also a copy on the server.
    this.vizCatalog = {
      "default": {
        EnumPlotType:  "contour",
        EnumContourVariable:  "uds_0_scalar",
        DoubleContourValue:  400,
        EnumColorVariable: "pressure",
        CellPlotName: "plot name",
      }
    };

    this.renderer = {};

    // this.divRenderer = document.createElement('div');
    // this.divRenderer.id = "divRender";
    // document.body.appendChild(this.divRenderer);

    // this.divRenderer.style.position = 'relative';
    // this.divRenderer.style.width = '100vw';
    // this.divRenderer.style.height = '100vh';
    // this.divRenderer.style.overflow = 'hidden';
    // this.divRenderer.style.zIndex = '10';

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
      // Create a vtk renderer.
      this.renderer = VtkRenderer.newInstance({ client: this.model.pvwClient });

      // Place it in the container set up for it.
      this.renderer.setContainer(document.getElementById("canvasContainer"));
      // renderer.onImageReady(() => {
      //   console.log('image ready (for next command)');
      // });
      window.renderer = this.renderer;
      SizeHelper.onSizeChange(() => {
        this.renderer.resize();
      });
      SizeHelper.startListening();
      this.connectionReady = true;

      // Now that the connection is ready, retrieve the data catalog and the
      // starter version of the viz catalog.
      this.model.pvwClient.amsService.getDataCatalog();

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

    this.onDrawCommand = this.onDrawCommand.bind(this);
  }

  onDrawCommand(drawCommand) {
    console.log("onDrawCommand is to execute:", drawCommand);
    this.model.pvwClient.amsService.executePlot(drawCommand);
  }

  render() {
    console.log("rendering AMSPlot:", this.model);
    return (
      <div>
        <AMSControlPanel model={this.model}
                         vizCatalog={this.vizCatalog}
                         dataCatalog={this.props.dataCatalog}
                         executeDrawCommand={this.onDrawCommand}
        />
        <div id="canvasContainer"
             style={{position: 'relative',
                     width: '100vw',
                     height: '100vh',
                     overflow: 'hidden',
                     zIndex: '10',
                    }}
        />
      </div>
    )
  }
}

export default AMSPlot;


