import React from 'react';
import AMSPlotDialog from '../AMSPlotDialog';
import NumberSliderWidget from 'paraviewweb/src/React/Widgets/NumberSliderWidget';

// This class controls two sets of data about the dialogs it manages.  Each
// set of data involves a description of a dialog box -- a list of entries
// describing the widgets that make up the dialog -- and the results of a
// user's interaction with that dialog, an entry in a catalog of
// visualizations, or a draw command to execute.
//
//   - The first set refers to the plot dialog, that describes what a
//     visualization looks like (e.g. contour of constant pressure, colored
//     with velocity, etc).  This is the vizCatalog and the vizDialogSpec.
//
//   - The second set refers to a list of visualization names and data sets
//     to which they might be applied.  This is constructed from the
//     vizCatalog and an input dataCatalog to make the drawDialogSpec.
//
// The two dialogs are both rendered with the PlotCatalog component, so the
// specs for the two dialogs are similar in structure.  The specs have
// little relevance outside this component, so they are pretty much internal
// only.
//
// The component includes two buttons, one for each dialog.
//
// The state of the component includes the spec for each dialog, as well as
// the two catalogs.
//
// Input data includes: vizCatalog, dataCatalog.  See js/src/index.js for
// description of these objects.  There is also a deliverDrawCommand
// function sent down for sending the output back up.  
//
// State includes the input vizCatalog and dataCatalog.  The vizCatalog is
// subject to modification by the vizDialog.
//
// Class also includes: vizDialogSpec, drawDialogSpec.  These are simple
// lists of dialog components and options.  Note that the drawDialogSpec
// incorporates the keys of the dataCatalog and the vizCatalog (which is
// modified by the vizDialog).
//
// Output data: vizCatalog, the (possibly modified) catalog of available
// visualizations and drawCommand, a combination of visualization and data
// references that are to be combined and drawn.

class AMSControlPanel extends React.Component {
  constructor(props) {
    super(props);
    console.log("Constructing AMSControlPanel:", props);

    // The vizCatalog and dataCatalog are passed back and forth between
    // client and server.  The server has the authoritative dataCatalog, and
    // we have the authoritative vizCatalog.  The vizCatalog is the state of
    // the client and the dataCatalog is part of the server's state.  Thus,
    // references to the dataCatalog over here go through props.
    this.state = {
      vizCatalog: props.vizCatalog,
    };

    // The dialog specs are built from the client state, to show the user a
    // menu of options.
    this.drawDialogSpec = {};
    this.vizDialogSpec = {};
    this.currentViz = Object.keys(props.vizCatalog)[0];
    this.currentData = Object.keys(props.dataCatalog)[0];
    
    this.returnDrawCommand = this.returnDrawCommand.bind(this);
    this.returnVizCatalogEntry = this.returnVizCatalogEntry.bind(this);

    this.buildVizDialogSpecs();
    this.buildDrawDialogSpecs();
  }

  buildDrawDialogSpecs() {
    this.drawDialogSpec = {
      plotName: {
        data: { value: this.currentViz, id: "plotName" },
        widgetType: "enum",
        depth: 1,  // This refers to the order in which the panel elements appear.
        ui: {
          propType: "enum",
          label: "Visualization Name",
          domain: Object.keys(this.props.vizCatalog).reduce(function(res, cur) {
            res[cur] = cur;
            return res;
          }, {}),
          type: "string",
          layout: '1',
          help: "Select by name a visualization to render."          ,
          componentLabels: [''],
        },
        show: () => true,
        onChange: function onChange(data) {
          this.drawDialogSpec[data.id].data.value = data.value[0];
          data.value = this.drawDialogSpec[data.id].data.value;
          this.currentViz = data.value;
          this.render();
        }
      },
      dataSource: {
        data: { value: this.currentData, id: "dataSource" },
        widgetType: "enum",
        depth: 2,
        ui: {
          propType: "enum",
          label: "Data Source",
          domain: Object.keys(this.props.dataCatalog).reduce(function(res, cur) {
            res[cur] = cur;
            return res;
          }, {}),
          type: "string",
          layout: '1',
          help: "select a data source by name.",
          componentLabels: [''],
        },
        show: () => true,
        onChange: function onChange(data) {
          this.drawDialogSpec[data.id].data.value = data.value[0];
          data.value = this.drawDialogSpec[data.id].data.value;
          this.currentData = data.value;
          this.render();
        }
      }
    };

    for (var key in this.drawDialogSpec) {
      this.drawDialogSpec[key].onChange =
        this.drawDialogSpec[key].onChange.bind(this);
    };
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
          //console.log("contour variable show:", this);
          return true;
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
        show: () => true,
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

    console.log("show state in returnVizCatalogEntry:", this.currentViz, this.state.vizCatalog, this.vizDialogSpec);

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
    var vizCatalogCopy = this.state.vizCatalog;
    vizCatalogCopy[newEntryName] = newEntry;
    this.setState({vizCatalog: vizCatalogCopy});

    // Adjust the corresponding entry in the drawDialogSpec.  First we
    // adjust the list of data sets to correspond to the data catalog (in
    // case it has changed recently).
    this.drawDialogSpec.plotName.ui.domain =
      Object.keys(this.props.dataCatalog).reduce(function(res, cur) {
        res[cur] = cur;
        return res;
      }, {});
    // Then we adjust the list of available (named) visualizations.  We
    // don't count on the setState() function above to have had effect yet,
    // so we do it off the modified copy.
    this.drawDialogSpec.dataSource.ui.domain =
      Object.keys(vizCatalogCopy).reduce(function(res, cur) {
        res[cur] = cur;
        return res;
      }, {});

    console.log("return catalog entry", this.drawDialogSpec);
    
    // Draw this plot.  
    this.props.executeDrawCommand({
      visualization: this.vizDialogSpec.CellPlotName.data.value[0],
      data: this.drawDialogSpec.dataSource.data.value,
      vizCatalog: vizCatalogCopy
    });

    this.render();
  }

  returnDrawCommand() {
    //console.log("returned draw command:", p);

    // Draw this plot.  This should specify the data, too.
    this.props.executeDrawCommand({
      visualization: this.currentViz,
      data: this.currentData,
      vizCatalog: this.state.vizCatalog,
    });

    this.render();
  }
  

  render() {

    this.buildDrawDialogSpecs();
    //console.log("AMSControlPanel render: ", this.state);

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
    
    var testy = {hello: 52.6};
    //console.log("gto:", this.props.gto);

    return (
        <center>
        <div style={{width: '100%', display: 'table'}}>
        <AMSPlotDialog buttonLabel="Edit plot descriptions"
                       title="Edit plot description"
                       dialogSpec={this.vizDialogSpec}
                       closeLabel="Save"
                       returnDialogResults={this.returnVizCatalogEntry}/>        
        <AMSPlotDialog buttonLabel="Choose plot to draw"
                       title="Select visualization"
                       closeLabel="Draw"
                       dialogSpec={this.drawDialogSpec}
                       returnDialogResults={this.returnDrawCommand}/>        
        <div style={{display: 'table-cell'}}>
        <button onClick={() => this.props.model.pvwClient.amsService.testButton(testy)}>test</button>
        <button onClick={() => this.props.model.pvwClient.amsService.showTankGeometry()}>tank</button>
        <button onClick={() => this.props.model.pvwClient.amsService.clearAll()}>clear</button>
        </div>
        </div>

        </center>
    );
  }
}

export default AMSControlPanel;
