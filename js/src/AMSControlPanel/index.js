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

    // The dialog specs are built from the client state, to show the user a
    // menu of options.
    this.drawDialogSpec = {};


    if (!this.currentData) this.currentData = Object.keys(props.dataCatalog)[0];
    if (!this.currentViz) this.currentViz = Object.keys(props.vizCatalog)[0];

    this.returnDrawCommand = this.returnDrawCommand.bind(this);

    this.buildDrawDialogSpecs();
  }


    // Adjust the corresponding entry in the drawDialogSpec.  First we
    // adjust the list of data sets to correspond to the data catalog (in
    // case it has changed recently).
    // this.drawDialogSpec.plotName.ui.domain =
    //   Object.keys(this.props.dataCatalog).reduce(function(res, cur) {
    //     res[cur] = cur;
    //     return res;
    //   }, {});


  buildDrawDialogSpecs() {
    this.drawDialogSpec = {
      plotName: {
        data: { value: (this.currentViz) ? this.currentViz :
                    Object.keys(this.props.vizCatalog)[0],
                id: "plotName" },
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
        data: { value: (this.currentData) ? this.currentData :
                    Object.keys(this.props.dataCatalog)[0],
                id: "dataSource" },
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

  returnDrawCommand() {
    //console.log("returned draw command:", p);

    // Draw this plot.  This should specify the data, too.
    this.props.executeDrawCommand({
      visualization: this.currentViz,
      data: this.currentData,
      vizCatalog: this.props.vizCatalog,
    });

    this.render();
  }


  render() {

    this.buildDrawDialogSpecs();
    //console.log("AMSControlPanel render: ", this.state);

    return (
        <center>
        <div style={{display: 'inline-block'}}>
        <AMSPlotDialog buttonLabel="Choose plot to draw"
                       title="Select visualization"
                       closeLabel="Draw"
                       dialogSpec={this.drawDialogSpec}
                       returnDialogResults={this.returnDrawCommand}/>
        <button onClick={() => this.props.model.pvwClient.amsService.testButton(this.props.view)}>test</button>
        <button onClick={() => this.props.model.pvwClient.amsService.showTankGeometry(this.props.view)}>tank</button>
        <button onClick={() => this.props.model.pvwClient.amsService.clearAll(this.props.view)}>clear</button>
        </div>

        </center>
    );
  }
}

export default AMSControlPanel;
