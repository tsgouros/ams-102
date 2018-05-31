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

        # This is the list of catalog names, file names, what's in
        # them, and so on.
        self.dataCatalog = {}


        # This is a set of render views on which things can be drawn.  Think
        # of these as being attached to different render windows over on the
        # client.
        self.renderViews = AMSRenderViewCollection()

        # The collection of data objects.  Each entry is a file, and all the
        # variables and what-have-you that can be read from it.  The
        # authoritative version of this collection is over here on the
        # server.
        self.dataObjects = AMSDataObjectCollection()

        # The variety of ways one might look at all the objects.  The client
        # can add to this collection, and the authoritative version of the
        # collection is over there on the client.
        self.vizCookBook = AMSCookBook()

        # This is a combination of data and viz recipe that makes a single
        # visualization.
        self.currentViz = AMSViz(None, None, None)

        self.toggle = True
        self.data0on = True
        self.data1on = False

        # A time stamp to keep from overloading the server.
        self.lastTime = 0

        self.debug = True

    def printDebug(self):
        if self.debug:
            # This retrieves the name of the calling function.
            # 0:filename, 1:line number, 2:function, 3:calling string
            functionName = traceback.extract_stack(None, 2)[0][2]
            print("calling " + functionName + " for " + self.name)

    def initializeData(self, inputDataCatalog):
        """
        Initialize data from the data catalog.
        """
        for entry in inputDataCatalog.keys():
            self.addObject(entry, \
                           AMSDataObject(inputDataCatalog[entry], \
                                         self.renderViews.getPrimary().getRV()))

        self.renderViews.getPrimary().takeStandardView()

    def getInput(self):
        return self.dataset

    def addObject(self, name, dataObject):
        if isinstance(dataObject, AMSDataObject):
            self.dataObjects.addObject(name, dataObject)

    @exportRPC('amsprotocol.get.view.id')
    def getViews(self, i):
        return {
            "viewID": self.renderViewCollection.getViewID(i)
        }

    @exportRPC("amsprotocol.get.data.catalog")
    def getDataCatalog(self):
        """
        Returns the data catalog to the client.  Also reviews the data as
        it passes through to get the variable names and ranges.
        """
        return self.dataObjects.getDataCatalogForTransmission()

    @exportRPC("amsprotocol.show.tank.geometry")
    def showTankGeometry(self, view):

        print "View specified:", view
        self.renderViews.getPrimary().toggleTank()
        self.getApplication().InvokeEvent('UpdateEvent')



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
        print "execute.viz", view, arg

        vizName = arg["visualization"]
        vizRecipe = arg["vizCatalog"][vizName]
        dataName = arg["data"]

        # The recipe we're receiving is either not in our current catalog, or
        # it is and should be replaced with this one.  Remember, the client
        # has the authoritative recipe collection.
        self.vizCookBook.addRecipe(vizName, vizRecipe)

        if self.debug:
            self.vizCookBook.printBook()

        # Select a render view, and create a viz object for it, using the
        # given data set and recipe.
        self.renderViews.getPrimary().addViz(self.dataObjects.getObject(dataName), vizName, vizRecipe)

        # Execute that viz object.
        self.renderViews.getPrimary().drawViz()

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



