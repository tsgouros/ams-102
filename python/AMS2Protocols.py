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

    def clearFilters(self):
        for f in simple.GetSources().values():
            if f.GetProperty("Input") is not None:
                simple.Delete(f)

    def clearAll(self):
        for f in simple.GetSources().values():
            simple.Delete(f)
            
            
    def makeContour(self):

        # get color transfer function/color map for the data to color with.
        dataLUT = simple.GetColorTransferFunction(self.plotRecipe.get('EnumColorVariable'))

        # create a new 'Contour'
        contour = simple.Contour(Input=self.dataObject.getData())

        print "DoubleContourValue", self.plotRecipe.get('DoubleContourValue')
        print "EnumContourVariable", self.plotRecipe.get('EnumContourVariable')
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

    def getName(self):
        return self.name
        
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
        self.shown = None

    def __getitem__(self, i):
        if len(self.index) > i:
            return self.index[self.index.keys()[i]]
        else:
            return None

        
    def addObject(self, name, dataObject):
        self.index[name] = dataObject

    def getObject(self, name):
        return self.index[name]

    def getFirst(self):
        if len(self.index) > 0:
            return self.index[self.index.keys()[0]]
        else:
            return None

    def keys(self):
        return self.index.keys()

    def getShown(self):
        """
        Returns the data object currently being shown in the view.
        """
        return self.shown

    def plotData(self, name, recipe):
        return AMSPlot(self.index[name], recipe)

        
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

        # Find length of longest key.
        maxl = 0
        for k in self.plotDict.keys():
            maxl = max(maxl, len(k))
        
        for k in self.plotDict.keys():
            print "  {0}  {1}:  {2}".format(k, " "*(maxl-len(k)), self.plotDict[k]['value'])

        
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

# >>> import AMS2Protocols as am
# >>> d = am.AMSDataObject(am.caseFileL)
# >>> d.caseData.GetDataInformation()
# <paraview.servermanager.DataInformation object at 0x11f043ed0>
# >>> d.caseData.GetDataInformation().GetNumberOfPoints()
# 448763L
# >>> d.caseData.GetDataInformation().GetNumberOfCells()
# 3536197L
# >>> d.caseData.PointData[:]
# [Array: abs_angular_coordinate, Array: absolute_pressure, Array: adaption_curvature, Array: adaption_function, Array: adaption_iso_value, Array: adaption_space_gradient, Array: angular_coordinate, Array: axial_coordinate, Array: axial_velocity, Array: boundary_cell_dist, Array: boundary_normal_dist, Array: cell_children, Array: cell_element_type, Array: cell_equiangle_skew, Array: cell_equivolume_skew, Array: cell_id, Array: cell_partition_active, Array: cell_partition_stored, Array: cell_refine_level, Array: cell_reynolds_number, Array: cell_surface_area, Array: cell_type, Array: cell_volume, Array: cell_volume_change, Array: cell_wall_distance, Array: cell_warp, Array: cell_weight, Array: cell_zone, Array: density, Array: density_all, Array: dp_dx, Array: dp_dy, Array: dp_dz, Array: dx_velocity_dx, Array: dx_velocity_dy, Array: dx_velocity_dz, Array: dy_velocity_dx, Array: dy_velocity_dy, Array: dy_velocity_dz, Array: dynamic_pressure, Array: dz_velocity_dx, Array: dz_velocity_dy, Array: dz_velocity_dz, Array: face_area_magnitude, Array: face_handedness, Array: helicity, Array: interface_overlap_fraction, Array: mark_poor_elememts, Array: mass_imbalance, Array: mesh_x_velocity, Array: mesh_y_velocity, Array: mesh_z_velocity, Array: orthogonal_quality, Array: partition_neighbors, Array: pressure, Array: pressure_coefficient, Array: production_of_k, Array: radial_coordinate, Array: radial_velocity, Array: rel_tangential_velocity, Array: rel_total_pressure, Array: rel_velocity_magnitude, Array: relative_velocity_angle, Array: relative_x_velocity, Array: relative_y_velocity, Array: relative_z_velocity, Array: skin_friction_coef, Array: strain_rate_mag, Array: tangential_velocity, Array: total_pressure, Array: turb_diss_rate, Array: turb_intensity, Array: turb_kinetic_energy, Array: uds_0_diff_scalar, Array: uds_0_scalar, Array: velocity, Array: velocity_angle, Array: velocity_magnitude, Array: viscosity_eff, Array: viscosity_lam, Array: viscosity_ratio, Array: viscosity_turb, Array: vorticity_mag, Array: wall_shear, Array: x_coordinate, Array: x_face_area, Array: x_velocity, Array: x_vorticity, Array: x_wall_shear, Array: y_coordinate, Array: y_face_area, Array: y_plus, Array: y_star, Array: y_velocity, Array: y_vorticity, Array: y_wall_shear, Array: z_coordinate, Array: z_face_area, Array: z_velocity, Array: z_vorticity, Array: z_wall_shear]
# >>> d.caseData.PointData
# <paraview.servermanager.FieldDataInformation object at 0x11f043ed0>
# >>> d.caseData.CellData[:]
# []
# >>> d.caseData.PointData.keys()
# ['abs_angular_coordinate', 'absolute_pressure', 'adaption_curvature', 'adaption_function', 'adaption_iso_value', 'adaption_space_gradient', 'angular_coordinate', 'axial_coordinate', 'axial_velocity', 'boundary_cell_dist', 'boundary_normal_dist', 'cell_children', 'cell_element_type', 'cell_equiangle_skew', 'cell_equivolume_skew', 'cell_id', 'cell_partition_active', 'cell_partition_stored', 'cell_refine_level', 'cell_reynolds_number', 'cell_surface_area', 'cell_type', 'cell_volume', 'cell_volume_change', 'cell_wall_distance', 'cell_warp', 'cell_weight', 'cell_zone', 'density', 'density_all', 'dp_dx', 'dp_dy', 'dp_dz', 'dx_velocity_dx', 'dx_velocity_dy', 'dx_velocity_dz', 'dy_velocity_dx', 'dy_velocity_dy', 'dy_velocity_dz', 'dynamic_pressure', 'dz_velocity_dx', 'dz_velocity_dy', 'dz_velocity_dz', 'face_area_magnitude', 'face_handedness', 'helicity', 'interface_overlap_fraction', 'mark_poor_elememts', 'mass_imbalance', 'mesh_x_velocity', 'mesh_y_velocity', 'mesh_z_velocity', 'orthogonal_quality', 'partition_neighbors', 'pressure', 'pressure_coefficient', 'production_of_k', 'radial_coordinate', 'radial_velocity', 'rel_tangential_velocity', 'rel_total_pressure', 'rel_velocity_magnitude', 'relative_velocity_angle', 'relative_x_velocity', 'relative_y_velocity', 'relative_z_velocity', 'skin_friction_coef', 'strain_rate_mag', 'tangential_velocity', 'total_pressure', 'turb_diss_rate', 'turb_intensity', 'turb_kinetic_energy', 'uds_0_diff_scalar', 'uds_0_scalar', 'velocity', 'velocity_angle', 'velocity_magnitude', 'viscosity_eff', 'viscosity_lam', 'viscosity_ratio', 'viscosity_turb', 'vorticity_mag', 'wall_shear', 'x_coordinate', 'x_face_area', 'x_velocity', 'x_vorticity', 'x_wall_shear', 'y_coordinate', 'y_face_area', 'y_plus', 'y_star', 'y_velocity', 'y_vorticity', 'y_wall_shear', 'z_coordinate', 'z_face_area', 'z_velocity', 'z_vorticity', 'z_wall_shear']
# >>> d.caseData.PointData["z_velocity"]
# Array: z_velocity
# >>> d.caseData.PointData["z_velocity"].GetName()
# 'z_velocity'
# >>> d.caseData.PointData["z_velocity"].GetNumberOfComponents()
# 1
# >>> d.caseData.PointData["velocity"].GetNumberOfComponents()
# 3
# >>> d.caseData.PointData["z_velocity"].GetRange(0)
# (-0.23729923367500305, 0.302336722612381)
# >>> d.caseData.PointData["velocity"].GetRange(0)
# (-0.6585575342178345, 0.6544119715690613)
# >>> d.caseData.PointData["velocity"].GetRange(1)
# (-0.6313338279724121, 0.6548640131950378)
# >>> d.caseData.PointData["velocity"].GetRange(2)
# (-0.23729923367500305, 0.302336722612381)
# >>> d.caseData.PointData["velocity"].GetDataType()
# 10
# >>>
