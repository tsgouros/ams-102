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

    // 
    this.state = {
      vizCatalog: props.vizCatalog,
      dataCatalog: props.dataCatalog,

    };

    this.drawDialogSpec = {
      plotName: {
        data: { value: Object.keys(props.vizCatalog)[0], id: "plotName" },
        widgetType: "enum",
        depth: 1,  // This refers to the order in which the panel elements appear.
        ui: {
          propType: "enum",
          label: "Visualization Name",
          domain: Object.keys(props.vizCatalog).reduce(function(acc, cur) {
            acc[cur] = cur;
            return acc;
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
          this.render();
        }
      },
      dataSource: {
        data: { value: Object.keys(props.dataCatalog)[0], id: "dataSource" },
        widgetType: "enum",
        depth: 2,
        ui: {
          propType: "enum",
          label: "Data Source",
          domain: Object.keys(props.dataCatalog).reduce(function(acc, cur) {
            acc[cur] = cur;
            return acc;
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
          this.render();
        }
      }
    };

    for (var key in this.drawDialogSpec) {
      this.drawDialogSpec[key].onChange =
        this.drawDialogSpec[key].onChange.bind(this);
    };

    
    this.vizDialogSpec = {
      CellPlotName: {
        data: { value: ["default"], id: "CellPlotName" },
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
          this.vizDialogSpec[data.id].data.value = data.value;
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
          domain: ["contour", "streamlines"].reduce(function(acc, cur) {
            acc[cur] = cur;
            return acc;
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
                  ].reduce(function(acc, cur) {
            acc[cur] = cur;
            return acc;
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
                  ].reduce(function(acc, cur) {
            acc[cur] = cur;
            return acc;
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

    this.updateSliderVal = this.updateSliderVal.bind(this);

    this.returnDrawCommand = this.returnDrawCommand.bind(this);
    this.returnVizCatalogEntry = this.returnVizCatalogEntry.bind(this);
  }

  // componentWillReceiveProps(nextProps) {

  //   // If props have changed, adjust the important parts of the draw dialog
  //   // spec and the visualization dialog spec.
  //   this.drawDialogSpec[1].vals = Object.keys(nextProps.dataCatalog);
  //   this.drawDialogSpec[1].selected = Object.keys(nextProps.dataCatalog)[0];

  //   // Also update the local copies of the data catalog and visualization
  //   // cookbook.
  //   this.setState({
  //     dataCatalog: nextProps.dataCatalog,
  //     vizCatalog: nextProps.vizCatalog
  //   });
  // }
  
  // The vizDialog is used to change or create a single entry in the
  // vizCatalog.  This function is invoked by the vizDialog to return it to
  // this component.
  returnVizCatalogEntry(p) {

    // Reset the entry in the plot catalog that has just been modified.
    var vizCatalogCopy = this.state.vizCatalog;
    vizCatalogCopy[p.CellPlotName.value[0]] = p;
    this.setState({vizCatalog: vizCatalogCopy});

    //console.log("show state in returnVizCatalogEntry:", this.state.vizCatalog);

    // Adjust the corresponding entry in the drawDialogSpec.  First we
    // adjust the list of data sets to correspond to the data catalog (in
    // case it has changed recently).
    this.drawDialogSpec[1].vals = Object.keys(this.state.dataCatalog);
    // Then we adjust the list of available (named) visualizations.  We
    // don't count on the setState() function above to have had effect yet,
    // so we do it off the modified copy.
    this.drawDialogSpec[0].vals = Object.keys(vizCatalogCopy);

    if (this.drawDialogSpec[0].vals.length > 0) {
      this.drawDialogSpec[0].selected = p.CellPlotName.value[0];
    } else {
      this.drawDialogSpec[0].selected = "plot name";
    }

    //console.log("return catalog entry", this.state);
    
    // Draw this plot.  This should specify the data, too.
    this.props.executeDrawCommand({
      visualization: this.drawDialogSpec[0].selected,
      data: this.drawDialogSpec[1].selected,
      vizCatalog: vizCatalogCopy
    });

    this.render();
  }

  returnDrawCommand(p) {
    //console.log("returned draw command:", p);

    // Draw this plot.  This should specify the data, too.
    this.props.executeDrawCommand({
      visualization: this.drawDialogSpec[0].selected,
      data: this.drawDialogSpec[1].selected,
      vizCatalog: this.state.vizCatalog,
    });

    this.render();
  }
  
  updateSliderVal(e) {
    // What changes, and what value?
    const which = e.target.name;
    const newVal = e.target.value;
    const toUpdateSlider = {};
    toUpdateSlider[which] = newVal;

    // Update the new value in the display.
    this.setState(toUpdateSlider);

    // Communicate it to the server.
    this.props.model.pvwClient.amsService.changeSurface(e.target.value);
  }

  render() {
    const [surfaceValue] = [this.state.surfaceValue];
    //console.log("AMSControlPanel render: ", this.state);

    var testy = {hello: 52.6};
    //console.log("gto:", this.props.gto);

    return (
        <center>
        <div style={{width: '100%', display: 'table'}}>
        <AMSPlotDialog buttonLabel="Edit plot descriptions"
                       title="Edit plot description"
                       dialogSpec={this.vizDialogSpec}
                       returnDialogResults={this.returnVizCatalogEntry}/>        
        <AMSPlotDialog buttonLabel="Choose plot to draw"
                       title="Select visualization"
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
