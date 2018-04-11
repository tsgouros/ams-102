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
        }

        dialogList.push({
          data: { value: dialogItem.selected, id: dialogItem.id },
          name: dialogItem.name,
          show: () => true,
          ui: {
            propType: dialogItem.widgetType,
            label: dialogItem.name,
            domain: itemDomain,
            type: dialogItem.dataType
          },
          onChange: function onChange(data) {
            console.log(JSON.stringify(data));
            if (dialogItem.widgetType == "enum") {
              dialogItem.selected = data.value[0];
              data.value = dialogItem.selected;
            } else {
              dialogItem.selected = data.value;
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
    
    this.currVal = 2;
    this.currVal3 = ['Temperature', 'Pressure', 'Velocity'];
    this.currValCheck = [true, false];
    this.currValSlider = 0.3;
    this.currValCell = [2, 3.5];

    this.properties1 = {
      data: { value: this.currVal, id: 'enum.property.id' },
      // help: 'Dynamic property list',
      name: 'enum',
      onChange: function onChange(data) {
        console.log(JSON.stringify(data));
        this.currVal = data.value[0];
        data.value = this.currVal;
        console.log(this.currVal);
        this.props.returnToParent({returning: this.currVal});
        this.render();
        console.log("render done");
        console.log(this);
      },
      show: () => true,
      ui: {
        propType: 'enum',
        label: 'Enum List',
        help: 'Choose one or multiple, if configured',
        domain: { one: 1, two: 2, three: 3, four: 4 },
        type: 'int',
      },
    };

    this.properties3 = {
      data: { value: this.currVal3, id: 'enum.property.id3' },
      name: 'enum',
      onChange: function onChange(data) {
        console.log(data.value);
        this.currVal3 = data.value[0];
        data.value = this.currVal3;
        this.render();
      },
      show: () => true,
      ui: {
        propType: 'enum',
        label: 'Multi-select list',
        help: 'Choose multiple food items',
        domain: {
          pasta: 'pasta',
          salad: 'salad',
          bread: 'bread',
          cheese: 'cheese',
          wine: 'wine',
          dessert: 'dessert',
        },
        type: 'string',
        //size: -1,
      },
    };

    this.propertiesCheck = {
      data: { value: this.currValCheck, id: 'checkbox.property.id2' },
      name: 'checkbox2',
      onChange: function onChange(data) {
        console.log(JSON.stringify(data));
        this.currValCheck = data.value;
        this.render();
      },
      show: () => true,
      ui: {
        propType: 'checkbox',
        componentLabels: ['first', 'second'],
        label: 'Checkbox list',
        help: 'Pick and choose',
      },
    };

    this.propSlider = {
      data: { value: this.currValSlider, id: 'slider.property.id4' },
      name: 'slider',
      onChange: function onChange(data) {
        console.log(JSON.stringify(data));
        this.currValSlider = data.value;
        this.render();
      },
      show: () => true,
      ui: {
        propType: 'slider',
        label: 'Number input',
        help: 'Set a numeric value',
        domain: { min: -1, max: 2 },
        type: 'double',
      },
    };

    this.propCell = {
      data: { value: this.currValCell, id: 'cell.property.id5' },
      name: 'cell',
      onChange: function onChange(data) {
        console.log(JSON.stringify(data));
        this.currValCell = data.value;
        this.render();
      },
      show: () => true,
      ui: {
        propType: 'cell',
        // set layout to '-1' for a growable list without component labels:
        layout: '2',
        label: 'Text/numeric input table',
        componentLabels: ['first', 'second'],
        help: 'Set some values',
        domain: { range: [{ min: -10, max: 20, force: true }] },
        type: 'double',
      },
    };

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

    // We use the same trick here to make sure that the 'this' pointer
    // indicates this class when it's used inside the onChange() method.
    this.properties1.onChange = this.properties1.onChange.bind(this);
    this.properties3.onChange = this.properties3.onChange.bind(this);
    this.propertiesCheck.onChange = this.propertiesCheck.onChange.bind(this);
    this.propSlider.onChange = this.propSlider.onChange.bind(this);
    this.propCell.onChange = this.propCell.onChange.bind(this);
  }
  
  toggleModal() {
    this.setState({
      isOpen: !this.state.isOpen
    });
  }
    
  render() {

    console.log("rendering:::", this.properties);

    return (
        <div className="PlotDialog" style={{display: 'table-cell'}}>
        <button onClick={this.toggleModal}>
          Open the Plot Dialog
        </button>

        <Modal show={this.state.isOpen}
          onClose={this.toggleModal}>

        <PropertyPanel {...this.properties} />
      
      `Not functional yet, but this is vaguely what it will look like:` + {JSON.stringify(this.properties1.data.value)}
        </Modal>
      </div>
    );
  }
}

export default PlotDialog;

