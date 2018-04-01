import React from 'react';
import Modal from './Modal';

class PlotDialog extends React.Component {
  constructor(props) {
    super(props);

    this.state = { isOpen: false };
    
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
    return (
      <div className="PlotDialog">
        <button onClick={this.toggleModal}>
          Open the Plot Dialog
        </button>

        <Modal show={this.state.isOpen}
          onClose={this.toggleModal}>
          `Here's some content for the plot dialog`
        </Modal>
      </div>
    );
  }
}

export default PlotDialog;

