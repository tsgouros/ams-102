import os, sys, logging, types, inspect, traceback, logging, re, json, base64
import time

# import RPC annotation
from wslink import register as exportRPC

# import paraview modules.
import paraview

from paraview import simple, servermanager
from paraview.web import protocols as pv_protocols

# Needed for:
#    vtkSMPVRepresentationProxy
#    vtkSMTransferFunctionProxy
#    vtkSMTransferFunctionManager
from vtk.vtkPVServerManagerRendering import vtkSMPVRepresentationProxy, vtkSMTransferFunctionProxy, vtkSMTransferFunctionManager

# Needed for:
#    vtkSMProxyManager
from vtk.vtkPVServerManagerCore import vtkSMProxyManager

# Needed for:
#    vtkDataObject
from vtk.vtkCommonDataModel import vtkDataObject

# =============================================================================
#
# Viewport Size
#
# =============================================================================

# class AMSViewportSize(pv_protocols.ParaViewWebProtocol):

#     # RpcName: mouseInteraction => viewport.mouse.interaction
#     @exportRpc("light.viz.viewport.size")
#     def updateSize(self, viewId, width, height):
#         view = self.getView(viewId)
#         view.ViewSize = [ width, height ]

# =============================================================================
#
# Configuration management
#
# =============================================================================

class AMSConfig(pv_protocols.ParaViewWebProtocol):
    def __init__(self, config, defaultProfile):
        self.config = config
        self.defaultProfile = defaultProfile

    @exportRPC("amsprotocol.configuration.get")
    def getDefaultProfile(self):
        return [self.config, self.defaultProfile]

# =============================================================================

def simpleColorBy(rep=None, value=None):
    """Set scalar color. This will automatically setup the color maps and others
    necessary state for the representations. 'rep' must be the display
    properties proxy i.e. the value returned by GetDisplayProperties() function.
    If none is provided the display properties for the active source will be
    used, if possible."""
    rep = rep if rep else simple.GetDisplayProperties()
    if not rep:
        raise ValueError ("No display properties can be determined.")

    association = rep.ColorArrayName.GetAssociation()
    arrayname = rep.ColorArrayName.GetArrayName()
    component = None
    if value == None:
        rep.SetScalarColoring(None, servermanager.GetAssociationFromString(association))
        return
    if not isinstance(value, tuple) and not isinstance(value, list):
        value = (value,)
    if len(value) == 1:
        arrayname = value[0]
    elif len(value) >= 2:
        association = value[0]
        arrayname = value[1]
    if len(value) == 3:
        # component name provided
        componentName = value[2]
        if componentName == "Magnitude":
          component = -1
        else:
          if association == "POINTS":
            array = rep.Input.PointData.GetArray(arrayname)
          if association == "CELLS":
            array = rep.Input.CellData.GetArray(arrayname)
          if array:
            # looking for corresponding component name
            for i in range(0, array.GetNumberOfComponents()):
              if componentName == array.GetComponentName(i):
                component = i
                break
              # none have been found, try to use the name as an int
              if i ==  array.GetNumberOfComponents() - 1:
                try:
                  component = int(componentName)
                except ValueError:
                  pass
    if component is None:
      rep.SetScalarColoring(arrayname, servermanager.GetAssociationFromString(association))
    else:
      rep.SetScalarColoring(arrayname, servermanager.GetAssociationFromString(association), component)
    # rep.RescaleTransferFunctionToDataRange()


# =============================================================================
#
# Dataset management
#
# =============================================================================


from AMS2Protocols import *


class AMSTest(pv_protocols.ParaViewWebProtocol):

    def __init__(self, config, profile):
        super(AMSTest, self).__init__()
        self.context = None
        self.extractBlocks = None
        self.colormaps = {}
        self.foreground = [ 1, 1, 1]
        self.background = [ 0, 0, 0]
        self.colorBy = ('__SOLID__', '__SOLID__')

        self.config = config
        self.profile = profile

        # A time stamp to keep from overloading the server.
        self.lastTime = 0

        self.debug = True

        self.renderViews = AMSRenderViewCollection()
        self.renderViews.addView(AMSRenderView("sphere"))
        self.renderViews.addView(AMSRenderView("cone"))


    def printDebug(self):
        if self.debug:
            # This retrieves the name of the calling function.
            # 0:filename, 1:line number, 2:function, 3:calling string
            functionName = traceback.extract_stack(None, 2)[0][2]
            print("calling " + functionName + " for " + self.name)

    @exportRPC('amsprotocol.get.render.view.ids')
    def getViews(self):
        return self.renderViews.getIDList()

    @exportRPC("amsprotocol.heartbeat.update")
    def heartbeatUpdate(self):
        """
        Meant to be called at regular intervals so that the other graphics
        routines can just set parameters and get out.  Sort of simulates a
        kind of threading.
        """
        self.getApplication().InvokeEvent('UpdateEvent')
        return "heart is beating"


    @exportRPC("amsprotocol.execute.viz")
    def executeViz(self, view, arg):
        # The arg here is a dict that contains the selected visualization
        # recipe name, the visualization cookbook, the name of the data
        # source, which hopefully is an entry in the data catalog.  The
        # authoritative copy of the data catalog is over here, so need not be
        # included in the data passed from the client.
        print "execute.viz", view

        # Execute that viz object.
        self.renderViews.getView(view).drawViz()

        # This makes the client update its view.
        self.getApplication().InvokeEvent('UpdateEvent')



    @exportRPC("amsprotocol.test.button")
    def testButton(self, arg):

        print("calling testbutton with: ")
        print(arg)

        arg['hello'] = 342.4
        arg['message'] = "******** executed testButton with: " + str(arg) + " *******"
        return arg

    @exportRPC("amsprotocol.clear.all")
    def clearAll(self, view):

        print "Clear view:", view
        self.currentViz.clearAll()
        self.getApplication().InvokeEvent('UpdateEvent')

#



