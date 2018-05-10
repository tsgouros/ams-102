import React from 'react';
import Modal from './Modal';

//import DropDownWidget from 'paraviewweb/src/React/Widgets/DropDownWidget';
//import TextInputWidget from 'paraviewweb/src/React/Widgets/TextInputWidget';

import AMSPropertyPanel from '../AMSPropertyPanel';
//import PropertyPanel from 'paraviewweb/src/React/Properties/PropertyPanel';

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
      //dialogDescription: this.props.deliverDialogSpec,
      //title: this.props.buttonLabel,
    };

    // This will hold the results of the dialog session.  We have to
    // keep the widget type because there is something odd about the
    // handling of values for the enum type.
    this.dialogResults = {};
    for (var key in this.props.dialogSpec) {
      this.dialogResults[key] = {
        value: this.props.dialogSpec[key].data.value,
        widgetType: this.props.dialogSpec[key].widgetType,
      };
    };

    this.properties = {
      input: [
        {
          title: props.title,
          contents: this.generateDialogList(this.props.dialogSpec),
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
  }

  generateDialogList(dialogSpec) {
    // Accept an object dialogSpec, and return a list, ordered by the 'depth'
    // field in each entry.
    var outList = [];
    for (var key in dialogSpec) {
      if (outList.length == 0) {
        outList = [ dialogSpec[key] ];
      } else {
        var i = 0;
        while ((i < outList.length) &&
               (outList[i].depth < dialogSpec[key].depth)) i += 1;
        outList.splice(i, 0, dialogSpec[key]);
      }
    }

    return outList;
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

    this.properties.input[0].title = this.props.title;
    this.properties.input[0].contents = 
      this.generateDialogList(this.props.dialogSpec);
    
    console.log("AMSPlotDialog rendering", this.props.buttonLabel, this.properties, this.state);

    return (
        <div className="AMSPlotDialog" style={{display: 'table-cell'}}>
        <button onClick={this.toggleModal}>
        {this.props.buttonLabel}
        </button>

        <Modal show={this.state.isOpen}
               onClose={this.toggleModalAndExecute}
               onCancel={this.toggleModal}
        >

        <AMSPropertyPanel {...this.properties} />
      
        </Modal>
      </div>
    );
  }
}

export default AMSPlotDialog;

