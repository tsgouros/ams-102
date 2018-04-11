import React from 'react';
import Modal from './Modal';

//import DropDownWidget from 'paraviewweb/src/React/Widgets/DropDownWidget';
//import TextInputWidget from 'paraviewweb/src/React/Widgets/TextInputWidget';

import PropertyPanel from 'paraviewweb/src/React/Properties/PropertyPanel';

class PlotDialog extends React.Component {
  constructor(props) {
    super(props);


    console.log("props:", props);
    
    this.state = { isOpen: false };

    // Get the data from the parent.  This will be a description of what
    // the dialog should look like, a collection of objects, each of which
    // has a name to display, a type of widget, the values it can take, and
    // the value that is selected.
    this.dialogDescription = this.props.deliverPayloadToChild();

    // This will hold the results of the dialog session.  We have to
    // keep the widget type because there is something odd about the
    // handling of values for the enum type.
    this.dialogResults =
      this.dialogDescription.reduce(function(dialogObj,dialogItem) {
        dialogObj[dialogItem.id] = {
          value: dialogItem.selected,
          widgetType: dialogItem.widgetType,
        };
        return dialogObj;
      }, {});

    console.log("dialogDescription:", this.dialogDescription);

    // Convert the dialog description into a list of actionable pieces, as
    // they are expected by the PropertyPanel widget.  This is essentially
    // just format conversion, plus defining the onChange() function.
    this.dialogList = 
      this.dialogDescription.reduce(function(dialogList, dialogItem) {
        let itemDomain = {};
        if (dialogItem.widgetType == "enum") {
          itemDomain = dialogItem.vals.reduce(function(result, item) {
            result[item] = item; return result;}, {});
        } else if (dialogItem.widgetType == "slider") {
          itemDomain = { min: dialogItem.vals[0], max: dialogItem.vals[1] };
        } else if (dialogItem.widgetType == "cell") {
          itemDomain = { range: [{ min: dialogItem.vals[0],
                                   max: dialogItem.vals[1],
                                   force: true,
                                 }]
                       };
        }

        dialogList.push({
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
          onChange: function onChange(data) {
            console.log("onChange:", JSON.stringify(data));
            if (this.dialogResults[data.id].widgetType == "enum") {
              this.dialogResults[data.id].value = data.value[0];
              data.value = this.dialogResults[data.id].value;
            } else {
              this.dialogResults[data.id].value = data.value;
            }
            this.render();
          },
        });
        return dialogList;
      }, [] );

    // Make sure all the onChange functions see the correct render() method.
    for (var i = 0; i < this.dialogList.length; i++) {
      this.dialogList[i].onChange = this.dialogList[i].onChange.bind(this);
    }
    
    console.log("dialogList:", this.dialogList);
    
    this.properties = {
      input: [
        {
          title: 'Edit a Visualization',
          contents: this.dialogList,
          payload: this.props.deliverPayloadToChild(),
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
    // React.Component, which has the setState() method used in toggleModal.
    this.toggleModal = this.toggleModal.bind(this);
  }
  
  toggleModal() {
    this.setState({
      isOpen: !this.state.isOpen
    });
  }
    
  render() {

    console.log("rendering:::", this.properties, this.dialogResults);

    return (
        <div className="PlotDialog" style={{display: 'table-cell'}}>
        <button onClick={this.toggleModal}>
          Open the Plot Dialog
        </button>

        <Modal show={this.state.isOpen}
          onClose={this.toggleModal}>

        <PropertyPanel {...this.properties} />
      
        </Modal>
      </div>
    );
  }
}

export default PlotDialog;

