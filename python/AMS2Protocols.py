import os, sys, logging, types, inspect, traceback, logging, re, json, base64
import time
import threading

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

def ColorBy(rep=None, value=None):
    """
    Set scalar color. This will automatically setup the color maps and others
    necessary state for the representations. 'rep' must be the display
    properties proxy i.e. the value returned by GetDisplayProperties() function.
    If none is provided the display properties for the active source will be
    used, if possible.
    """
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

class AMSPlot(object):
    """
    Contains data and a plot recipe.  The view is executed with the
    execute() method.
    """
    def __init__(self, dataObject, plotRecipe):
        self.dataObject = dataObject
        self.plotRecipe = plotRecipe

    def draw(self):

        if self.plotRecipe.get('EnumPlotType') == 'contour':
            self.makeContour()
        else:
            self.makeStream()

        simple.Render()

            
    def makeContour(self):

        # get color transfer function/color map for the data to color with.
        dataLUT = simple.GetColorTransferFunction(self.plotRecipe.get('EnumColorVariable'))

        # create a new 'Contour'
        contour = simple.Contour(Input=self.dataObject.getData())

        print self.plotRecipe.get('DoubleContourValue')
        print self.plotRecipe.get('EnumContourVariable')
        # Properties modified on contour
        #contour.ContourBy = ['POINTS', self.plotRecipe.get('enum.contour.variable')]
        contour.ContourBy = ['POINTS', 'uds_0_scalar']
        contour.Isosurfaces = self.plotRecipe.get('DoubleContourValue')


        # show data in view
        contourDisplay = simple.Show(contour, self.dataObject.renderView)
        # trace defaults for the display properties.
        contourDisplay.Representation = 'Surface'

        # show color bar/color legend
        contourDisplay.SetScalarBarVisibility(self.dataObject.renderView, True)

        # set scalar coloring
        ColorBy(contourDisplay, ('POINTS', self.plotRecipe.get('EnumColorVariable'), 'Magnitude'))

        # Hide the scalar bar for this color map if no visible data is
        # colored by it.
        simple.HideScalarBarIfNotNeeded(dataLUT, self.dataObject.renderView)

        # rescale color and/or opacity maps used to include current data range
        contourDisplay.RescaleTransferFunctionToDataRange(True, False)

        # reset view to fit data
        self.dataObject.renderView.ResetCamera()

        self.dataObject.renderView.Update()

    def makeStream(self):

        # get color transfer function/color map for the data to color with.
        dataLUT = simple.GetColorTransferFunction(self.plotRecipe.get('EnumColorVariable'))

        # create a new 'Stream Tracer'
        streamTracer = simple.StreamTracer(Input=self.dataObject.getData(),
                                           SeedType='High Resolution Line Source')

        # Properties modified on streamTracer.SeedType
        streamTracer.SeedType.Resolution = 450

        # Properties modified on streamTracer
        streamTracer.MaximumSteps = 600

        # show data in view
        streamTracerDisplay = simple.Show(streamTracer, self.dataObject.renderView)
        # trace defaults for the display properties.
        streamTracerDisplay.Representation = 'Surface'

        # show color bar/color legend
        streamTracerDisplay.SetScalarBarVisibility(self.dataObject.renderView, False)

        # update the view to ensure updated data information
        self.dataObject.renderView.Update()

        # create a new 'Ribbon'
        ribbon = simple.Ribbon(Input=streamTracer)

        # Properties modified on ribbon
        ribbon.Scalars = ['POINTS', self.plotRecipe.get('EnumColorVariable')]

        # show data in view
        ribbonDisplay = simple.Show(ribbon, self.dataObject.renderView)
        # trace defaults for the display properties.
        ribbonDisplay.Representation = 'Surface'

        # hide data in view
        simple.Hide(streamTracer, self.dataObject.renderView)

        # show color bar/color legend
        ribbonDisplay.SetScalarBarVisibility(self.dataObject.renderView, True)

        # update the view to ensure updated data information
        self.dataObject.renderView.Update()

        # set scalar coloring
        ColorBy(ribbonDisplay, ('POINTS', self.plotRecipe.get('EnumColorVariable')))

        # Hide the scalar bar for this color map if no visible data is
        # colored by it.
        simple.HideScalarBarIfNotNeeded(dataLUT, self.dataObject.renderView)

        # rescale color and/or opacity maps used to include current data range
        ribbonDisplay.RescaleTransferFunctionToDataRange(True, False)

        # show color bar/color legend
        ribbonDisplay.SetScalarBarVisibility(self.dataObject.renderView, True)

        # get color transfer function/color map for 'uds_0_scalar'
        colorLUT = simple.GetColorTransferFunction(self.plotRecipe.get('EnumColorVariable'))

        # Properties modified on ribbon
        ribbon.Width = 0.003

        self.dataObject.renderView.ResetCamera()
    
        # update the view to ensure updated data information
        self.dataObject.renderView.Update()

        # set active source
        simple.SetActiveSource(streamTracer)

        # Properties modified on streamTracer.SeedType
        streamTracer.SeedType.Resolution = 200

        # update the view to ensure updated data information
        self.dataObject.renderView.Update()


    
class AMSDataObject(object):
    """
    Contains a data file name and some descriptive material about it.
    """
    def __init__(self, dataFile):

        self.name = dataFile
        self.debug = True
        
        self.dataFile = dataFile

        self.renderView = simple.GetActiveViewOrCreate('RenderView')

        # create a new 'EnSight Reader'
        self.caseData = simple.EnSightReader(CaseFileName=self.dataFile)

        # show data in view
        self.caseDataDisplay = simple.Show(self.caseData, self.renderView)
        # trace defaults for the display properties.
        self.caseDataDisplay.Representation = 'Surface'

        # show color bar/color legend
        self.caseDataDisplay.SetScalarBarVisibility(self.renderView, True)

        # hide data in view
        simple.Hide(self.caseData, self.renderView)

        # update the view to ensure updated data information
        self.renderView.Update()

        self.tankGeometryShown = False
        self.tankGeometryInit = False

    def printDebug(self):
        if self.debug:
            # This retrieves the name of the calling function.
            # 0:filename, 1:line number, 2:function, 3:calling string
            functionName = traceback.extract_stack(None, 2)[0][2]
            print("calling " + functionName + " for " + self.name)

    def getData(self):
        return self.caseData

    def getDataDisplay(self):
        return self.caseDataDisplay

    def setIsoSurfaces(self, isoSurfaces):
        self.isoSurfaces = isoSurfaces

    
    def toggleTankGeometry(self):
        self.printDebug()

        if not self.tankGeometryInit:

            # create a new 'Contour'
            self.contour2 = simple.Contour(Input=self.caseData)
            self.contour2.PointMergeMethod = 'Uniform Binning'

            # Properties modified on self.contour2
            self.contour2.ContourBy = ['POINTS', 'wall_shear']
            self.contour2.Isosurfaces = [0.0002]

            # show data in view
            self.contour2Display = simple.Show(self.contour2, self.renderView)

            # trace defaults for the display properties.
            self.contour2Display.Representation = 'Surface'
            self.contour2Display.ColorArrayName = [None, '']
            self.contour2Display.OSPRayScaleFunction = 'PiecewiseFunction'
            self.contour2Display.SelectOrientationVectors = 'None'
            self.contour2Display.ScaleFactor = -2.0000000000000002e+298
            self.contour2Display.SelectScaleArray = 'None'
            self.contour2Display.GlyphType = 'Arrow'
            self.contour2Display.GlyphTableIndexArray = 'None'
            self.contour2Display.GaussianRadius = -1.0000000000000001e+298
            self.contour2Display.SetScaleArray = [None, '']
            self.contour2Display.ScaleTransferFunction = 'PiecewiseFunction'
            self.contour2Display.OpacityArray = [None, '']
            self.contour2Display.OpacityTransferFunction = 'PiecewiseFunction'
            self.contour2Display.DataAxesGrid = 'GridAxesRepresentation'
            self.contour2Display.SelectionCellLabelFontFile = ''
            self.contour2Display.SelectionPointLabelFontFile = ''
            self.contour2Display.PolarAxes = 'PolarAxesRepresentation'

            # init the 'GridAxesRepresentation' selected for 'DataAxesGrid'
            self.contour2Display.DataAxesGrid.XTitleFontFile = ''
            self.contour2Display.DataAxesGrid.YTitleFontFile = ''
            self.contour2Display.DataAxesGrid.ZTitleFontFile = ''
            self.contour2Display.DataAxesGrid.XLabelFontFile = ''
            self.contour2Display.DataAxesGrid.YLabelFontFile = ''
            self.contour2Display.DataAxesGrid.ZLabelFontFile = ''

            # init the 'PolarAxesRepresentation' selected for 'PolarAxes'
            self.contour2Display.PolarAxes.PolarAxisTitleFontFile = ''
            self.contour2Display.PolarAxes.PolarAxisLabelFontFile = ''
            self.contour2Display.PolarAxes.LastRadialAxisTextFontFile = ''
            self.contour2Display.PolarAxes.SecondaryRadialAxesTextFontFile = ''

            # Properties modified on contour2Display
            self.contour2Display.Opacity = 0.1

            # change solid color
            self.contour2Display.DiffuseColor = [0.0, 0.5, 0.5]

            self.tankGeometryInit = True
            self.tankGeometryShown = True

        else:
            if self.tankGeometryShown:
                self.contour2Display = simple.Hide(self.contour2, self.renderView)
                self.tankGeometryShown = False
            else:
                self.contour2Display = simple.Show(self.contour2, self.renderView)
                self.tankGeometryShown = True

        self.renderView.Update()

    def hide(self):
        return

    def show(self):
        return

    def takeStandardView(self):

        # current camera placement for renderView1
        self.renderView.CameraPosition = [1.3051878628081257, -1.32358496378265, -0.017141331493847792]
        self.renderView.CameraFocalPoint = [-0.052487090229988105, 0.03264869749546056, -0.3026974257081747]
        self.renderView.CameraViewUp = [-0.5051031518286454, -0.33848038039346323, 0.7939155106820026]
        self.renderView.CameraParallelScale = 0.502148522908922
        self.renderView.Update()
        ##################################################


        
class AMSDataObjectCollection(object):
    """
    A whole slew of data objects, organized by name.
    """
    def __init__(self):
        self.index = dict()

    def addObject(self, name, dataObject):
        self.index[name] = dataObject

    def getObject(self, name):
        return self.index[name]

        
class AMSPlotRecipe(object):
    """
    A description of a plot.
    """
    def __init__(self, plotDict):
        self.plotDict = plotDict

    def getName(self):
        return self.plotDict['CellPlotName']['value'][0]
        
    def get(self, name):
        return self.plotDict[name]['value']

    def printRecipe(self):
        print "Recipe name: ", self.getName()

        for k in self.plotDict.keys():
            print "  ", k, ":    ", self.plotDict[k]['value']

        
class AMSCookBook(object):
    """
    A collection of recipes, organized by name.
    """
    def __init__(self):
        self.index = dict()

    def addRecipe(self, plotRecipe):
        self.index[plotRecipe.getName()] = plotRecipe

#    def addRecipe(self, name, plotRecipe):
#        self.index[name] = plotRecipe

    def getRecipe(self, name):
        return self.index[name]

    def printBook(self):
        for k in self.index.keys():
            self.index[k].printRecipe()



rec1 = {u'enum.color.variable': {u'widgetType': u'enum', u'value': u'pressure'}, u'double.contour.value': {u'widgetType': u'slider', u'value': 500}, u'enum.contour.variable': {u'widgetType': u'enum', u'value': u'velocity'}, u'enum.plotType': {u'widgetType': u'enum', u'value': u'contour'}}

rec2 = {u'enum.color.variable': {u'widgetType': u'enum', u'value': u'pressure'}, u'double.contour.value': {u'widgetType': u'slider', u'value': 500}, u'enum.contour.variable': {u'widgetType': u'enum', u'value': u'velocity'}, u'enum.plotType': {u'widgetType': u'enum', u'value': u'streamlines'}}

rec3 = {u'enum.color.variable': {u'widgetType': u'enum', u'value': u'uds_0_scalar'}, u'double.contour.value': {u'widgetType': u'slider', u'value': 500}, u'enum.contour.variable': {u'widgetType': u'enum', u'value': u'velocity'}, u'enum.plotType': {u'widgetType': u'enum', u'value': u'streamlines'}}

rec4 = {u'enum.color.variable': {u'widgetType': u'enum', u'value': u'uds_0_scalar'}, u'double.contour.value': {u'widgetType': u'slider', u'value': 500}, u'enum.contour.variable': {u'widgetType': u'enum', u'value': u'pressure'}, u'enum.plotType': {u'widgetType': u'enum', u'value': u'contour'}}


caseFileL = '/Users/tomfool/tech/18/amgen/ams-102-AgileViz/EnSight/mat-viz-mofTFF-90L-9.1lpm-100rpm/mat-viz-mofTFF-90L-9.1lpm-100rpm.case'
caseFileH = '/Users/tomfool/tech/18/amgen/ams-102-AgileViz/EnSight/mat-viz-mofTFF-90L-9.1lpm-250rpm/mat-viz-mofTFF-90L-9.1lpm-250rpm.case'

def clearFilters():
    for f in simple.GetSources().values():
        if f.GetProperty("Input") is not None:
            simple.Delete(f)

def clearAll():
    for f in simple.GetSources().values():
        simple.Delete(f)    
