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

    // This is the visualization cookbook, a collection of visualization recipes
    // that can be applied to the data sources.  It is a an association of names
    // and descriptions of visualizations.  This is the authoritative copy,
    // though there is (probably) also a copy on the server.
    this.vizCatalog = {
      "default": {
        EnumPlotType:  "contour",
        EnumContourVariable:  "uds_0_scalar",
        DoubleContourValue:  [400],
        EnumColorVariable: "pressure",
        CellPlotName: "plot name",
      }
    };

    this.rendererTwoVisible = true;

    // Create our 'smart connection' object using the config sent down
    // via props.
    const config = props.config;
    this.smartConnect = SmartConnect.newInstance({ config });
    console.log("in AMSPlot constructor:", props, this.smartConnect);

    this.model = {};
    this.connectionReady = false;

    // To create a visualization, you need a recipe (what kind of plot, what
    // variables, what colors, etc) and some data to which it is to be
    // applied.  We will proceed by creating a cookbook of such recipes over
    // here on the client side and a catalog of available data over there on
    // the server.  (It might eventually be that the cookbook is seeded from
    // a server-side cache, but during a session, the authoritative version
    // is on the client.)
    //

    // A list of data names and some descriptive information about each data
    // source.  The authoritative copy is over on the server side, but we keep a
    // copy over here to help populate the dialogs.
    this.dataCatalog = {
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

    // We also need a 'master' data catalog entry that has the union of all the
    // variable lists from throughout the data catalog, along with the maximum
    // ranges of each of those variables.
    this.masterVariables = {};

    // A list of the renderers we'll be using.  Each one of these corresponds to
    // a canvas element.
    this.renderers = [];

    // This is the collection of RPC functions supported by the pvpython
    // server.  They are fed to the smartConnect function and returned as
    // part of the pvwClient object, which is how they can be accessed
    // henceforward.
    //
    // The 'session.call' method references a string that must appear
    // verbatim on the server side.  Note that capital letters are NOT
    // permitted, per some quirk in the wslink implementation.  There seems
    // to be no limitation on the data types that can be passed.  JS objects
    // wind up as Python dicts over there, for example.
    this.protocols = {
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

          createRenderer: (container) => {
            session.call('amsprotocol.create.renderer', [container])
              .then((result) => {
                console.log('create renderer result: ', result);
                this.renderers.push(VtkRenderer.newInstance({
                  client: this.model.pvwClient,
                  viewId: result,
                }) );
                this.renderers[this.renderers.length - 1].setContainer(
                  document.getElementById(container));
              });
            console.log("*** sending for another viewID");
          },

          executeViz: (view, value) => {
            session.call('amsprotocol.execute.viz', [ view, value ])
              .then((result) => console.log('result: ' + result));
            console.log("******* execute viz ------>", view, value, "<<<");
          },

          getDataCatalog: () => {
            session.call('amsprotocol.get.data.catalog', [])
              .then((result) => {
                this.dataCatalog = result;

                // This sorts through all the entries in the catalog and
                // comes up with a summary entry that has a superset of all
                // the variable sets and maximum ranges for each variable.
                // Note that this means that you may be able to ask for
                // visualizations that cannot be rendered, so a later check
                // on variables is necessary.
                this.masterVariables = Object.values(this.dataCatalog).reduce(
                  function (res, entry) {
                    Object.keys(entry.variables).forEach(
                      function(variable) {
                        if (res && variable in Object.keys(res)) {
                          res[variable].range[0] =
                            min(res[variable].range[0],
                                entry.variables[variable].range[0]);
                          res[variable].range[1] =
                            max(res[variable].range[1],
                                entry.variables[variable].range[1]);
                        } else {
                          res[variable] = entry.variables[variable];
                        }
                      }
                    );
                    return res;
                  }, {});
                console.log('catalog result: ', result, this.masterVariables);
              });
            console.log("******* get data catalog ------<<<");
          },

          testButton: (testValue) => {
            session.call('amsprotocol.test.button', [ testValue ])
              .then((result) => {
                console.log('result: ', result.hello);
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
                                       this.protocols);

      // Create a couple of vtk renderers and place them in the containers
      // set up for them.
      this.model.pvwClient.amsService.createRenderer("renderContainerOne");
      this.model.pvwClient.amsService.createRenderer("renderContainerTwo");

      // renderer.onImageReady(() => {
      //   console.log('image ready (for next command)');
      // });

      SizeHelper.onSizeChange(() => {
        this.renderers[0].resize();
        this.renderers[1].resize();
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
    console.log("using view:", this.renderers[0], this.renderers[0].getViewId());
    this.model.pvwClient.amsService.executeViz(this.renderers[0].getViewId(),
                                               drawCommand);
  }

  onDrawCommandTwo(drawCommand) {
    console.log("onDrawCommand is to execute:", drawCommand);
    this.model.pvwClient.amsService.executeViz(this.renderers[1].getViewId(),
                                               drawCommand);
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
          // This is just a dummy list, replaced in the render() method.
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
          return (this.vizDialogSpec.EnumPlotType.data.value === "contour");
        },
        onChange: function onChange(data) {
          this.vizDialogSpec[data.id].data.value = data.value[0];
          data.value = this.vizDialogSpec[data.id].data.value;
          // Retrieve data variable range.
          this.vizDialogSpec.DoubleContourValue.ui.domain.range[0].min =
            this.masterVariables[data.value].range[0];
          this.vizDialogSpec.DoubleContourValue.ui.domain.range[0].max =
            this.masterVariables[data.value].range[1];
          this.vizDialogSpec.DoubleContourValue.ui.label =
            "Contour value (" +
            this.masterVariables[data.value].range[0].toFixed(2) + ", " +
            this.masterVariables[data.value].range[1].toFixed(2) + ")";
          this.vizDialogSpec.DoubleContourValue.data.value = [
            0.01 * Math.trunc(100 *
              (this.masterVariables[data.value].range[0] +
               this.masterVariables[data.value].range[1]) / 2.0)
            ];
          this.render();
        }
      },
      DoubleContourValue: {
        data: {value: [400.0], id: "DoubleContourValue" },
        widgetType: "cell",
        depth: 12,
        ui: {
          propType: "cell",
          label: "Contour value (0.0, 800.0)",
          domain: { range: [{ min: 0.0, max: 800.0, force: true }] },
          type: "double",
          layout: '1',
          help: "Select a contour value",
          componentLabels: [''],
        },
        show: () => {
          return (this.vizDialogSpec.EnumPlotType.data.value === "contour");
        },
        onChange: function onChange(data) {
          this.vizDialogSpec[data.id].data.value = data.value;
          this.render();
        }
      },
      CheckColorType: {
        data: {value: false, id: "CheckColorType" },
        widgetType: "checkbox",
        depth: 14,
        ui: {
          propType: "checkbox",
          label: "Solid color?",
          domain: [0, 1],
          type: "string",
          layout: '1',
          help: "Check to use solid color instead of a variable for a contour.",
          componentLabels: ["c"],
        },
        show: () => {
          return (this.vizDialogSpec.EnumPlotType.data.value === "contour");
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
          // This is just a dummy list, replaced in the render() method.
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
        show: () => {
          return (!this.vizDialogSpec.CheckColorType.data.value);
        },
        onChange: function onChange(data) {
          this.vizDialogSpec[data.id].data.value = data.value[0];
          data.value = this.vizDialogSpec[data.id].data.value;
          this.render();
        }
      },
      ContourColor: {
        data: {value: [0,0,0], id: "ContourColor" },
        widgetType: "cell",
        depth: 18,
        ui: {
          propType: "cell",
          label: "Color",
          domain: { range: [{min: 0.0, max: 1.0, force: true}] },
          type: "double",
          layout: '3',
          componentLabels: ["r", "g", "b"],
        },
        show: () => {
          return (this.vizDialogSpec.CheckColorType.data.value);
        },
        onChange: function onChange(data) {
          this.vizDialogSpec[data.id].data.value = data.value;
          this.render();
        }
      },
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

    // Data repair section: Is there anything we need to do to the dialog
    // output before using it in a visualization?

    // First, we take care to make sure the color values are all numbers.  The
    // built-in code forces 0<x<1, but it doesn't prevent blanks or NaN.
    this.vizDialogSpec.ContourColor.data.value =
      this.vizDialogSpec.ContourColor.data.value.map(
        (x) => { return isNaN(x) ? 0.0 : x; }
      );

    var newEntryName = this.vizDialogSpec.CellPlotName.data.value;
    var newEntry = Object.values(this.vizDialogSpec).reduce(function(res, val) {
      if (val.widgetType === "cell" && val.ui.type === "string") {
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

    // We are assuming here that all the members of the data catalog share the
    // same variable list.  This probably is not true, so there should be a
    // check somewhere on the viz side in case we ask for a variable that
    // isn't there.

    const sortedVariables =  Object.keys(
      this.dataCatalog["m100rpm"].variables).sort().reduce(
        function(res, cur) {
          res[cur] = cur;
          return res;
        }, {});

    this.vizDialogSpec.EnumContourVariable.ui.domain = sortedVariables;
    this.vizDialogSpec.EnumColorVariable.ui.domain = sortedVariables;


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
                             dataCatalog={this.dataCatalog}
                             executeDrawCommand={this.onDrawCommandOne}
                             view='renderers[0]'
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
                             dataCatalog={this.dataCatalog}
                             executeDrawCommand={this.onDrawCommandTwo}
                             view='renderers[1]'
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


