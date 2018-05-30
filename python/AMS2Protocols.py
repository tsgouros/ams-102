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

class AMSRenderView(object):
    """
    A VTK render view, along with the plotting apparatus and information
    about it that is currently being displayed with it.  In our conception
    of these objects, a render view contains a "viz" object that holds the
    data being visualized and the recipe used to visualize it.  The render
    object may or may not be displaying that object, depending on whether
    the drawViz() method has been called.  (The object itself might be
    hidden, too, but that's a different detail.)

    """
    def __init__(self):

        self.RV = simple.CreateView("RenderView")
        self.viewID = self.RV.GetGlobalIDAsString()
        self.currentViz = None
        self.tankVisible = False

    def getRV(self):
        return self.RV

    def getID(self):
        return self.RV.GetGlobalIDAsString()

    def link(self, renderViewToLink):
        simple.AddCameraLink(renderViewToLink, self.RV, self.viewID + "LINK")

    def addViz(self, dataObject, vizName, vizRecipe):
        print "addViz:", dataObject, vizName, vizRecipe
        if isinstance(dataObject, AMSDataObject) and \
           isinstance(vizRecipe, dict):
            self.currentViz = AMSViz(dataObject, vizName, vizRecipe)
            self.tankVisible = False
        else:
            print "bad viz argument"
            exit()

    def drawViz(self):
        if self.currentViz:
            self.currentViz.draw(self.RV)

    def drawTank(self):
        if self.currentViz:
            self.currentViz.drawTankGeometry(self.RV)
            self.tankVisible = True

    def eraseTank(self):
        if self.currentViz:
            self.currentViz.eraseTankGeometry(self.RV)
            self.tankVisible = False

    def toggleTank(self):
        if self.tankVisible:
            self.eraseTank()
        else:
            self.drawTank()

    def takeStandardView(self):

        # A standard camera placement, arbitrarily chosen.  Choose another
        # if you like.
        self.RV.CameraPosition = [1.305, -1.323, -0.0171]
        self.RV.CameraFocalPoint = [-0.0524, 0.0326, -0.302]
        self.RV.CameraViewUp = [-0.505, -0.338, 0.793]
        self.RV.CameraParallelScale = 0.502
        self.RV.Update()



class AMSRenderViewCollection(object):

    """
    A collection of render views, all linked together, so they should all
    have the same viewing position.
    """
    def __init__(self):
        self.renderList = []

        # There will always be the first render view, and we call it the
        # primary.
        self.addView()

    def __getitem__(self, i):
        if isinstance(i, (int, long)):
            return self.renderList[i]
        else:
            return None

    def addView(self):
        self.renderList.append(AMSRenderView())

        # If this is not the first, link it to a previous one.
        i = len(self.renderList) - 1
        if i > 1:
            self.renderList[i].link(self.renderList[i - 1])

        return self.renderList[i]

    def getView(self, i):
        return self.renderList[i]

    def getPrimary(self):
        return self.renderList[0]



# view1 = simple.CreateView("myfirstview")
# view2 = simple.CreateView("mysecondview")
# simple.AddCameraLink(view1, view2, "arbitraryNameOfLink")




class AMSViz(object):
    """
    Contains data to visualize and a plot recipe.  The visualization is
    executed with the draw() method.  This is meant to be kept as part of a
    render view object, to represent what is visualized at the moment.

    """
    def __init__(self, dataObject, vizName, vizRecipe):
        self.dataObject = dataObject
        self.vizName = vizName
        self.vizRecipe = vizRecipe

        self.debug = True

    def draw(self, RV):

        if self.vizRecipe.get('EnumPlotType') == 'contour':
            self.makeContour(RV)
        else:
            self.makeStream(RV)

        simple.Render()

    def clearFilters(self):
        for f in simple.GetSources().values():
            if f.GetProperty("Input") is not None:
                simple.Delete(f)

    def clearAll(self):
        for f in simple.GetSources().values():
            simple.Delete(f)


    def makeContour(self, RV):

        # get color transfer function/color map for the data to color with.
        dataLUT = simple.GetColorTransferFunction(self.vizRecipe.get('EnumColorVariable'))

        # create a new 'Contour'
        contour = simple.Contour(Input=self.dataObject.getData())

        # Properties modified on contour
        contour.ContourBy = ['POINTS', self.vizRecipe.get('EnumContourVariable')]
        contour.Isosurfaces = self.vizRecipe.get('DoubleContourValue')

        # show data in view
        contourDisplay = simple.Show(contour, RV)
        # trace defaults for the display properties.
        contourDisplay.Representation = 'Surface'

        if self.vizRecipe.get('CheckColorType'):

            # Color the contour with a solid color, as specified.
            print "****** coloring with a solid color:", self.vizRecipe.get('ContourColor')

            contourDisplay.DiffuseColor = self.vizRecipe.get('ContourColor')

        else:
            # Color the contour with color keyed to another variable.
            print "******* coloring with another variable:", self.vizRecipe.get('EnumColorVariable')

            # show color bar/color legend
            contourDisplay.SetScalarBarVisibility(RV, True)

            # set scalar coloring
            ColorBy(contourDisplay, ('POINTS', self.vizRecipe.get('EnumColorVariable'), 'Magnitude'))

        # Hide the scalar bar for this color map if no visible data is
        # colored by it.
        simple.HideScalarBarIfNotNeeded(dataLUT, RV)

        # rescale color and/or opacity maps used to include current data range
        contourDisplay.RescaleTransferFunctionToDataRange(True, False)

        # reset view to fit data
        RV.ResetCamera()

        RV.Update()

    def makeStream(self, RV):

        # get color transfer function/color map for the data to color with.
        dataLUT = simple.GetColorTransferFunction(self.vizRecipe.get('EnumColorVariable'))

        # create a new 'Stream Tracer'
        streamTracer = simple.StreamTracer(Input=self.dataObject.getData(),
                                           SeedType='High Resolution Line Source')

        # Properties modified on streamTracer.SeedType
        streamTracer.SeedType.Resolution = 450

        # Properties modified on streamTracer
        streamTracer.MaximumSteps = 600

        # show data in view
        streamTracerDisplay = simple.Show(streamTracer, RV)
        # trace defaults for the display properties.
        streamTracerDisplay.Representation = 'Surface'

        # show color bar/color legend
        streamTracerDisplay.SetScalarBarVisibility(RV, False)

        # update the view to ensure updated data information
        RV.Update()

        # create a new 'Ribbon'
        ribbon = simple.Ribbon(Input=streamTracer)

        # Properties modified on ribbon
        ribbon.Scalars = ['POINTS', self.vizRecipe.get('EnumColorVariable')]

        # show data in view
        ribbonDisplay = simple.Show(ribbon, RV)
        # trace defaults for the display properties.
        ribbonDisplay.Representation = 'Surface'

        # hide data in view
        simple.Hide(streamTracer, RV)

        # show color bar/color legend
        ribbonDisplay.SetScalarBarVisibility(RV, True)

        # update the view to ensure updated data information
        RV.Update()

        # set scalar coloring
        ColorBy(ribbonDisplay, ('POINTS', self.vizRecipe.get('EnumColorVariable')))

        # Hide the scalar bar for this color map if no visible data is
        # colored by it.
        simple.HideScalarBarIfNotNeeded(dataLUT, RV)

        # rescale color and/or opacity maps used to include current data range
        ribbonDisplay.RescaleTransferFunctionToDataRange(True, False)

        # show color bar/color legend
        ribbonDisplay.SetScalarBarVisibility(RV, True)

        # get color transfer function/color map for 'uds_0_scalar'
        colorLUT = simple.GetColorTransferFunction(self.vizRecipe.get('EnumColorVariable'))

        # Properties modified on ribbon
        ribbon.Width = 0.003

        RV.ResetCamera()

        # update the view to ensure updated data information
        RV.Update()

        # set active source
        simple.SetActiveSource(streamTracer)

        # Properties modified on streamTracer.SeedType
        streamTracer.SeedType.Resolution = 200

        # update the view to ensure updated data information
        RV.Update()

    def drawTankGeometry(self, RV):
        self.printDebug()

        # create a new 'Contour'
        self.tankGeometry = simple.Contour(Input=self.dataObject.caseData)
        self.tankGeometry.PointMergeMethod = 'Uniform Binning'

        # Properties modified on self.tankGeometry
        self.tankGeometry.ContourBy = ['POINTS', 'wall_shear']
        self.tankGeometry.Isosurfaces = [0.0002]

        # show data in view
        self.tankGeometryDisplay = simple.Show(self.tankGeometry, RV)

        # Some display properties.
        self.tankGeometryDisplay.Representation = 'Surface'
        self.tankGeometryDisplay.ColorArrayName = [None, '']
        self.tankGeometryDisplay.OSPRayScaleFunction = 'PiecewiseFunction'
        self.tankGeometryDisplay.OpacityArray = [None, '']
        self.tankGeometryDisplay.OpacityTransferFunction = 'PiecewiseFunction'
        self.tankGeometryDisplay.Opacity = 0.1
        self.tankGeometryDisplay.DiffuseColor = [0.0, 0.5, 0.5]

        self.tankGeometryDisplay = simple.Show(self.tankGeometry, RV)
        RV.Update()

    def eraseTankGeometry(self, RV):
        self.tankGeometryDisplay = simple.Hide(self.tankGeometry, RV)
        RV.Update()


    def printDebug(self):
        if self.debug:
            # This retrieves the name of the calling function.
            # 0:filename, 1:line number, 2:function, 3:calling string
            functionName = traceback.extract_stack(None, 2)[0][2]
            print("calling " + functionName + " for " + self.vizName + " on " + self.dataObject.getName())



class AMSDataObject(object):
    """
    Contains a data file name and some descriptive material about it.

    Initializing the data seems to require having a render view on hand, but
    this isn't really a part of this object.  So it is part of the
    initialization, but is not kept around.

    """
    def __init__(self, dataCatalogEntry, RV):

        self.debug = True

        self.dataFile = dataCatalogEntry["fileName"]
        self.description = dataCatalogEntry["description"]

        # create a new 'EnSight Reader'
        self.caseData = simple.EnSightReader(CaseFileName=self.dataFile)

        # show data in view
        self.caseDataDisplay = simple.Show(self.caseData, RV)

        # Get variables and range data from the newly-opened file.
        self.variables = {}  #***************************TBD

        # Set some defaults for the display properties.
        self.caseDataDisplay.Representation = 'Surface'

        # show color bar/color legend
        self.caseDataDisplay.SetScalarBarVisibility(RV, True)

        # hide data in view
        simple.Hide(self.caseData, RV)

        # update the view to ensure updated data information
        RV.Update()

    def getName(self):
        return self.dataFile

    def printDebug(self):
        if self.debug:
            # This retrieves the name of the calling function.
            # 0:filename, 1:line number, 2:function, 3:calling string
            functionName = traceback.extract_stack(None, 2)[0][2]
            print("calling " + functionName + " for " + self.dataFile)

    def getData(self):
        return self.caseData

    def getDescription(self):
        return self.description

    def getDataFile(self):
        return self.dataFile

    def getVariables(self):
        return self.variables

    def setIsoSurfaces(self, isoSurfaces):
        self.isoSurfaces = isoSurfaces




class AMSDataObjectCollection(object):
    """
    A whole slew of data objects, organized by name.
    """
    def __init__(self):
        self.index = dict()
        self.shown = None

    def __getitem__(self, i):
        if isinstance(i, (int, long)):
            if len(self.index) > i:
                return self.index[self.index.keys()[i]]
            else:
                return None
        else:
            return self.index[i]


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

    def plotData(self, name, recipeName, cookBook):
        """
        Create a plot object for the given data, with the given visualization
        recipe.  Note that you have to execute the 'draw()' method of the plot
        object to see anything.
        """
        return AMSViz(self.index[name], cookBook.getRecipe(recipeName))


class AMSVizRecipe(object):
    """
    A description of a plot.  This is a small dict that contains the
    names of values needed for the visualizations.  The names of the
    values are the ids assigned to them in the dialog spec on the
    client side, which is why they might seem a little odd.
    """
    def __init__(self, vizRecipe):
        self.vizRecipe = vizRecipe

    def getName(self):
        return self.vizRecipe['CellPlotName']

    def get(self, item):
        """
        Return one of the items in a plot recipe.
        """
        return self.vizRecipe[item]

    def printRecipe(self):
        # Find length of longest key, to left-justify the recipe ingredients.
        maxl = 0
        for k in self.vizRecipe.keys():
            maxl = max(maxl, len(k))

        for k in self.vizRecipe.keys():
            print "    {0}{1}  :  {2}".format(k, " "*(maxl-len(k)), self.vizRecipe[k])


class AMSCookBook(object):
    """
    A collection of recipes, organized by name.
    """
    def __init__(self):
        self.index = dict()

#    def addRecipe(self, vizRecipe):
#        self.index[vizRecipe.getName()] = vizRecipe

    def addRecipe(self, name, vizRecipe):
        self.index[name] = AMSVizRecipe(vizRecipe)

    def getRecipe(self, name):
        return self.index[name]

    def printBook(self):
        print "Available visualization recipes:"
        for k in self.index.keys():
            print "  Recipe name: ", k
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

# view1 = simple.CreateView("myfirstview")
# view2 = simple.CreateView("mysecondview")
# simple.AddCameraLink(view1, view2, "arbitraryNameOfLink")

