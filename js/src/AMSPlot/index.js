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


//
// 1. Move render canvas from above down to here.  DONE
// 2. Move edit plot description from the control panel to this object. DONE
// 3. Add a second renderer.


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

    this.rendererTwoVisible = true;

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
      // Create a vtk renderer.
      this.rendererOne = VtkRenderer.newInstance({
        client: this.model.pvwClient,
        viewId: 'renderOne'
      });
      this.rendererTwo = VtkRenderer.newInstance({
        client: this.model.pvwClient,
        viewId: 'renderTwo'
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

    this.vizDialogSpec = {};
    this.currentViz = Object.keys(this.vizCatalog)[0];

    this.onDrawCommandOne = this.onDrawCommandOne.bind(this);
    this.onDrawCommandTwo = this.onDrawCommandTwo.bind(this);

    this.returnVizCatalogEntry = this.returnVizCatalogEntry.bind(this);
    this.buildVizDialogSpecs();
  }

  onDrawCommandOne(drawCommand) {
    console.log("onDrawCommand is to execute:", drawCommand);
    this.model.pvwClient.amsService.executeViz('one',drawCommand);
  }

  onDrawCommandTwo(drawCommand) {
    console.log("onDrawCommand is to execute:", drawCommand);
    this.model.pvwClient.amsService.executeViz('two',drawCommand);
  }

  buildVizDialogSpecs() {

    this.vizDialogSpec = {
      CellPlotName: {
        data: { value: [ this.currentViz ], id: "CellPlotName" },
        widgetType: "cell",
        depth: 1,
        ui: {
          propType: "cell",
          label: "Visualization name",
          domain: { range: [{ force: false }] },
          type: "string",
          layout: '1',
          help: "Give this collection of plot parameters a name so you can use it again.",
          componentLabels: [''],
        },
        show: () => true,
        onChange: function onChange(data) {
          console.log("changing the plot name:", data);
          this.vizDialogSpec[data.id].data.value = data.value;
          this.currentViz = data.value[0];
          this.render();
        }
      },
      EnumPlotType: {
        data: { value: "contour", id: "EnumPlotType" },
        widgetType: "enum",
        depth: 4,
        ui: {
          propType: "enum",
          label: "Visualization type",
          domain: ["contour", "streamlines"].reduce(function(res, cur) {
            res[cur] = cur;
            return res;
          }, {}),  // the list of possible values
          type: "string",           // 'string' or 'int'
          layout: '1',
          help: "Choose the type of plot to view.",
          componentLabels: [''],
        },
        show: () => true,
        onChange: function onChange(data) {
          this.vizDialogSpec[data.id].data.value = data.value[0];
          data.value = this.vizDialogSpec[data.id].data.value;
          this.render();
        }
      },
      EnumContourVariable: {
        data: { value: "uds_0_scalar", id: "EnumContourVariable" },
        widgetType: "enum",
        depth: 8,
        ui: {
          propType: "enum",
          label: "Contour variable",
          domain: ["uds_0_scalar",
                   "pressure",
                   "axial_velocity",
                   "radial_velocity",
                   "tangential_velocity"
                  ].reduce(function(res, cur) {
            res[cur] = cur;
            return res;
          }, {}),
          type: "string",
          layout: '1',
          help: "Which value to contour?",
          componentLabels: [''],
        },
        show: () => {
          if (this.vizDialogSpec.EnumPlotType.data.value === "contour") {
            return true;
          } else {
            return false;
          }
        },
        onChange: function onChange(data) {
          this.vizDialogSpec[data.id].data.value = data.value[0];
          data.value = this.vizDialogSpec[data.id].data.value;
          this.render();
        }
      },
      DoubleContourValue: {
        data: {value: [400.0], id: "DoubleContourValue" },
        widgetType: "cell",
        depth: 12,
        ui: {
          propType: "cell",
          label: "Contour value",
          domain: { range: [{ min: 0.0, max: 800.0, force: true }] },
          type: "double",
          layout: '1',
          help: "Select a contour value",
          componentLabels: [''],
        },
        show: () => {
          if (this.vizDialogSpec.EnumPlotType.data.value === "contour") {
            return true;
          } else {
            return false;
          }
        },
        onChange: function onChange(data) {
          this.vizDialogSpec[data.id].data.value = data.value;
          this.render();
        }
      },
      EnumColorVariable: {
        data: { value: "pressure", id: "EnumColorVariable" },
        widgetType: "enum",
        depth: 16,
        ui: {
          propType: "enum",
          label: "Color variable",
          domain: ["pressure",
                   "uds_0_scalar",
                   "axial_velocity",
                   "radial_velocity",
                   "tangential_velocity"
                  ].reduce(function(res, cur) {
            res[cur] = cur;
            return res;
          }, {}),
          type: "string",
          layout: '1',
          help: "Which variable to color the contour or streamline?",
          componentLabels: [''],
        },
        show: () => true,
        onChange: function onChange(data) {
          this.vizDialogSpec[data.id].data.value = data.value[0];
          data.value = this.vizDialogSpec[data.id].data.value;
          this.render();
        }
      },
      // {
      //   name: "contour value",
      //   widgetType: "slider",
      //   vals: [0.0, 800.0],
      //   selected: [400.0],
      //   id: "DoubleContourValue",
      //   dataType: "double",
      //   help: "Select a contour value",
      // },
      // {
      //   name: "some other value",
      //   widgetType: "cell",
      //   vals: [0, 1],
      //   selected: [0.5],
      //   id: "CellValue",
      //   dataType: "double",
      //   help: "A little help text...",
      // },
      // {
      //   name: "still another value",
      //   widgetType: "cell",
      //   vals: [0, 10],
      //   selected: [5],
      //   id: "CellValue2",
      //   dataType: "int",
      //   help: "A little help text...",
      // },
    };

    for (var key in this.vizDialogSpec) {
      this.vizDialogSpec[key].onChange =
        this.vizDialogSpec[key].onChange.bind(this);
    };
  }

  // The vizDialog is used to change or create a single entry in the
  // vizCatalog.  This function is invoked by the vizDialog to park the new
  // visualization in the catalog where it is convenient.
  returnVizCatalogEntry() {

    console.log("show state in returnVizCatalogEntry:", this.currentViz, this.vizCatalog, this.vizDialogSpec);

    var newEntryName = this.vizDialogSpec.CellPlotName.data.value;
    var newEntry = Object.values(this.vizDialogSpec).reduce(function(res, val) {
      if (val.widgetType === "cell") {
        res[val.data.id] = val.data.value[0];
      } else {
        res[val.data.id] = val.data.value;
      };
      return res;
    }, {});

    // Reset the entry in the plot catalog that has just been modified.
    this.vizCatalog[newEntryName] = newEntry;

    this.render();
  }

  render() {
    console.log("rendering AMSPlot:", this.model);

    this.vizDialogSpec.EnumContourVariable.ui.domain =
      Object.keys(this.props.dataCatalog["m100rpm"].variables).reduce(
        function(res, cur) {
          res[cur] = cur;
          return res;
        }, {});

    this.vizDialogSpec.EnumColorVariable.ui.domain =
      Object.keys(this.props.dataCatalog["m100rpm"].variables).reduce(
        function(res, cur) {
          res[cur] = cur;
          return res;
        }, {});


//      <button onClick={() => this.rendererTwoVisible = !this.rendererTwoVisible}>Two</button>


    return (
        <div style={{ width: '100vw', display: 'table' }}>
        <AMSPlotDialog buttonLabel="Edit plot descriptions"
                       title="Edit plot descriptions"
                       dialogSpec={this.vizDialogSpec}
                       closeLabel="Save"
                       returnDialogResults={this.returnVizCatalogEntry}
        />
        <div style={{display: 'table-row',
                     width: '100vw',
                    }}>
          <div style={{display: 'table-cell',
                       width: this.rendererTwoVisible ? '50%' : '100%',
                      }}>
            <AMSControlPanel model={this.model}
                             vizCatalog={this.vizCatalog}
                             dataCatalog={this.props.dataCatalog}
                             executeDrawCommand={this.onDrawCommandOne}
                             view='rendererOne'
            />
            <div id="renderContainerOne"
                 style={{position: 'relative',
                         width: '100%',
                         height: '80vh',
                         overflow: 'hidden',
                         zIndex: '10',
                        }}
            />
          </div>
        { this.rendererTwoVisible ? (
          <div style={{display: 'table-cell',
                       width: '50%',
                      }}>
            <AMSControlPanel model={this.model}
                             vizCatalog={this.vizCatalog}
                             dataCatalog={this.props.dataCatalog}
                             executeDrawCommand={this.onDrawCommandTwo}
                             view='rendererTwo'
                             width='50%'
            />
            <div id="renderContainerTwo"
                 style={{position: 'relative',
                         width: '100%',
                         height: '80vh',
                         overflow: 'hidden',
                         zIndex: '10',
                        }}
            />
          </div>
        ) : null }
       </div>
     </div>
    )
  }
}

export default AMSPlot;


