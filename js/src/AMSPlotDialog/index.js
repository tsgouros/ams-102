import React from 'react';
import Modal from './Modal';

//import DropDownWidget from 'paraviewweb/src/React/Widgets/DropDownWidget';
//import TextInputWidget from 'paraviewweb/src/React/Widgets/TextInputWidget';

import PropertyPanel from 'paraviewweb/src/React/Properties/PropertyPanel';

// This class presents the user with a dialog for doing something or other.
// The inputs are a spec for the dialog -- a list of what kinds of widgets
// should ask what kinds of questions -- and a function to call to deliver
// the results to the parent.
//
// Input data includes: dialogSpec
//
// State includes: whether the dialog is open or closed, the
// dialogDescription (which is just a lightly-processed version of the spec,
// perhaps with conditionals selected).
//
// Output data: An updated dialogSpec, with the "selected" fields filled in.

class AMSPlotDialog extends React.Component {
  constructor(props) {
    super(props);

    // The super doesn't seem to care about props, but props contains
    // the deliverDialogSpecs object, bringing data from our parent, and
    // the returnDialogResults object, for sending it back the other
    // direction.

    this.state = {
      // This refers to whether the dialog is being displayed or not.
      // See toggleModal() below.
      isOpen: false,

      // Get the data from the parent.  This will be a description of what
      // the dialog should look like, a collection of objects, each of which
      // has a name to display, a type of widget, the values it can take, and
      // the value that is selected.
      dialogDescription: this.props.deliverDialogSpec,

    };

    // This will hold the results of the dialog session.  We have to
    // keep the widget type because there is something odd about the
    // handling of values for the enum type.
    this.dialogResults =
      this.state.dialogDescription.reduce(function(dialogObj,dialogItem) {
        dialogObj[dialogItem.id] = {
          value: dialogItem.selected,
          widgetType: dialogItem.widgetType,
        };
        return dialogObj;
      }, {});

    //console.log("dialogResults:", this.dialogResults);
    //console.log("dialogDescription:", this.dialogDescription);

    // Convert the dialog description into a list of actionable pieces, as
    // they are expected by the PropertyPanel widget.  This is essentially
    // just format conversion, plus defining the onChange() function.
    //this.dialogList = [];

    
    //console.log("dialogList:", this.dialogList);
    
    this.properties = {
      input: [
        {
          title: 'Edit a Visualization',
          contents: this.generateDialogList(props.deliverDialogSpec),
        },
      ],
      // setting this change handler overrides all individual component
      // change handlers.
      // onChange: function onChange(data) {
      //   console.log(JSON.stringify(data));
      //   render();
      // },
      viewData: {},
    };

    // This has the effect of binding the 'this' pointer to the parent class,
    this.toggleModal = this.toggleModal.bind(this);
    this.toggleModalAndExecute = this.toggleModalAndExecute.bind(this);
    this.generateDialogList = this.generateDialogList.bind(this);

    // Do the same for all the onChange functions so they see the
    // correct render() method and can find the dialogResults object.
    for (var i = 0; i < this.properties.input[0].contents.length; i++) {
      // console.log("contents[",i,"]:", this.properties.input[0].contents[i]);
      this.properties.input[0].contents[i].onChange =
        this.properties.input[0].contents[i].onChange.bind(this);
    }
  }

  componentWillReceiveProps(nextProps) {

    this.properties.input[0].contents =
      this.generateDialogList(nextProps.deliverDialogSpec);

    // Fix the 'this' pointer for the onChange() methods.
    for (var i = 0; i < this.properties.input[0].contents.length; i++) {
      // console.log("*contents[",i,"]:", this.properties.input[0].contents[i]);
      this.properties.input[0].contents[i].onChange =
        this.properties.input[0].contents[i].onChange.bind(this);
    }

    console.log("AMSPlotDialog.cwrp:", this.properties.input[0].contents);
    
    this.setState({dialogDescription: nextProps.deliverDialogSpec});

  }
  
  generateDialogList(dialogSpec) {

    return dialogSpec.reduce(function(dL, dialogItem) {

      // The domains differ according to the widget type.
      let itemDomain = {};
      if (dialogItem.widgetType == "enum") {
        itemDomain = dialogItem.vals.reduce(function(result, item) {
          result[item] = item; return result;}, {});
      } else if (dialogItem.widgetType == "slider") {
        itemDomain = { min: dialogItem.vals[0], max: dialogItem.vals[1] };
      } else if (dialogItem.widgetType == "cell") {
        if (dialogItem.dataType != "string") {
          itemDomain = { range: [{ min: dialogItem.vals[0],
                                   max: dialogItem.vals[1],
                                   force: true,
                                 }]
                       };
        } else {
          itemDomain = { range: [{ force: false }] };
        }
      }

      // Add an item to the dialog list, this is the format expected
      // by the PropPanel widget.  Note that the id vaues must be
      // unique to each item.
      dL.push({
        data: { value: dialogItem.selected, id: dialogItem.id },
        name: dialogItem.name,
        show: () => true,
        widgetType: dialogItem.widgetType,
        ui: {
          propType: dialogItem.widgetType,
          label: dialogItem.name,
          domain: itemDomain,
          type: dialogItem.dataType,
          layout: '1',
          help: dialogItem.help,
          componentLabels: [''],
        },
        // componentWillReceiveProps: function componentWillReceiveProps(nextProps) {
        //   console.log("in dialog.cwrp:", nextProps, this);
        // },
        onChange: function onChange(data) {
          console.log("onChange:", data, this.dialogResults, this);
          if (this.dialogResults[data.id].widgetType == "enum") {
            this.dialogResults[data.id].value = data.value[0];
            data.value = this.dialogResults[data.id].value;
          } else {
            this.dialogResults[data.id].value = data.value;
          }
          this.render();
        },
      });
      return dL;
    }, [] );
  }

  // Called to open the dialog, and to close it.
  toggleModalAndExecute() {
    if (this.state.isOpen) {
      this.props.returnDialogResults(this.dialogResults);
    };

    this.setState({
      isOpen: !this.state.isOpen
    });
  }

  // Called to open the dialog, and to close it.
  toggleModal() {
    this.setState({
      isOpen: !this.state.isOpen
    });
  }

  render() {

    //console.log("AMSPlotDialog rendering", this.props.buttonLabel, this.state);

    return (
        <div className="AMSPlotDialog" style={{display: 'table-cell'}}>
        <button onClick={this.toggleModal}>
        {this.props.buttonLabel}
        </button>

        <Modal show={this.state.isOpen}
               onClose={this.toggleModalAndExecute}
               onCancel={this.toggleModal}
        >

        <PropertyPanel {...this.properties} />
      
        </Modal>
      </div>
    );
  }
}

export default AMSPlotDialog;

