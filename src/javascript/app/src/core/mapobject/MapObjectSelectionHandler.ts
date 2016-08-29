type MapObjectSelectionByType = { [objectType: string]: MapObjectSelection[]; };

interface SerializedSelectionHandler extends Serialized<MapObjectSelectionHandler> {
    _activeSelectionId: MapObjectSelectionId;
    selections: SerializedMapObjectSelection[];
}

class MapObjectSelectionHandler implements Serializable<MapObjectSelectionHandler> {

    viewer: Viewer;
    viewport: Viewport;

    /**
     * A hash where the selections are stored by their type.
     * When an object of class MapObjectSelectionHandler is created, the
     * active selection type will be null. For this reason there has to be an empty
     * array for this 'null' type, since otherwise this._selectionsByType[this._activeMapObjectType]
     * would be undefined, which would in turn lead to problems with angulars data binding.
     */
    private _selectionsByType: MapObjectSelectionByType = {
        null: []
    };

    private _activeMapObjectType: string = null;
    private _activeSelection: MapObjectSelection = null;
    private _segmentationLayers: {[objectType: string]: SegmentationLayer;} = {};

    /**
     * @classdesc A manager class that handles mapobject selections and how
     * objects are added to them.
     */
    constructor(viewer: Viewer) {
        this.viewer = viewer;
        this.viewport = viewer.viewport;

        // Register click listeners on the map.
        this.viewport.map.on('singleclick', (evt) => {
            this.viewport.map.forEachFeatureAtPixel(evt.pixel, (feat, layer) => {
                var mapObjectId = <number>feat.getId();
                var mapObjectType = feat.get('type');
                var clickPos = {x: evt.coordinate[0], y: evt.coordinate[1]};
                var mapObject = new MapObject(mapObjectId, mapObjectType);
                this.clickOnMapObject(mapObject, clickPos);
            });
        });
    }

    get hasActiveSelection() {
        return this._activeSelection !== null; 
    }

    get activeMapObjectType() {
        return this._activeMapObjectType;
    }

    set activeMapObjectType(t: string) {
        if (!this._isValidType(t)) {
            return;
        }

        // Hide all other selections on the map
        this.supportedMapObjectTypes.forEach((t2) => {
            if (t2 !== t) {
                var sels = this.getSelectionsForType(t2);
                sels.forEach((s) => {
                    s.selectionLayer.visible = false;
                });
            }
        });

        // Show only the selections for the just activated type 
        this.getSelectionsForType(t).forEach((s) => {
            s.selectionLayer.visible = true;
        });

        this._activeMapObjectType = t;

        this._hideSegmentationLayersExceptForType(t);
    }

    private _hideSegmentationLayersExceptForType(t: string) {
        // Hide all other segmentation layers (mapobject outlines)
        // form the map and only display the one for the active mapobject type.
        for (var t2 in this._segmentationLayers) {
            if (t2 !== t) {
                this._segmentationLayers[t2].visible = false;
            }
        }
        if (this._segmentationLayers[t] !== undefined) {
            this._segmentationLayers[t].visible = true;
        }
    }

    /**
     * Set the active selection, i.e., the selection to which new objects
     * are added.
     *
     * By passing null as the argument, the currently active selection will be 
     * set as inactive.
     */
    set activeSelection(sel: MapObjectSelection) {
        if (sel === null) {
            this._activeSelection = null;
        } else {
            // TODO: show segm layres
            this._activeSelection = sel;
            this._hideSegmentationLayersExceptForType(sel.mapObjectType);
        }
    }

    /**
     * Get the selection that is currently active.
     *
     * If no selection is chosen as active, the return value will be null.
     */
    get activeSelection(): MapObjectSelection {
        return this._activeSelection;
    }

    get supportedMapObjectTypes(): string[] {
        return _.chain(this._selectionsByType).keys().difference(['null']).value();
    }

    get selectionsForActiveType(): MapObjectSelection[] {
        return this._selectionsByType[this.activeMapObjectType];
    }

    getSelectionsForType(type: string): MapObjectSelection[] {
        if (!this._isValidType(type)) {
            return [];
        }
        return this._selectionsByType[type];
    }

    addMapObjectType(t: string) {
        this._selectionsByType[t] = [];
        if (this.activeMapObjectType === null) {
            this.activeMapObjectType = t;
        }
        var segmLayer = new SegmentationLayer(t, {
            tpoint: 0,
            experimentId: this.viewer.experiment.id,
            zplane: 0,
            size: this.viewport.mapSize,
            visible: false
        });
        this._segmentationLayers[t] = segmLayer;
        this.viewport.addLayer(segmLayer);
    }

    addSelection(sel: MapObjectSelection) {
        if (!this._isValidType(sel.mapObjectType)) {
            return;
        }
        this.getSelectionsForType(sel.mapObjectType).push(sel);
    }

    clickOnMapObject(mapObject: MapObject, clickPos: MapPosition) {
        if (this.hasActiveSelection && mapObject.type === this.activeMapObjectType) {
            var sel = this.activeSelection;
            if (sel) {
                sel.addRemoveMapObject(mapObject, clickPos);
            } else {
                console.log('No active selection found');
            }
        }
        // TODO: Issue some kind of "clicked on mapobject X type of event and callback
        // registered listeners"
    }

    getSelection(type: string, selectionId: MapObjectSelectionId): MapObjectSelection {
        if (!this._isValidType(type)) {
            return undefined;
        }
        var selections = this.getSelectionsForType(type);
        return _(selections).find((s) => {
            return s.id === selectionId;
        });
    }

    addNewSelection(type: string) {
        if (!this._isValidType(type)) {
            return undefined;
        }
        var id = this.getSelectionsForType(type).length;
        var color = this._getNextColor(type);
        var newSel = new MapObjectSelection(id, type, color);
        newSel.visualizeOnViewport(this.viewport);
        this.addSelection(newSel);
        return newSel;
    }

    private _getNextColor(type: string) {
        var sels = this.getSelectionsForType(type);
        var nColors = MapObjectSelection.availableColors.length;
        var possibleIds = _.range(nColors);
        var usedIds = _(sels).map(function(s) { return s.id % nColors; });
        var availableIds = _.difference(possibleIds, usedIds);
        // throw new Error(JSON.stringify(availableIds));
        if (availableIds.length != 0) {
            var id = availableIds[0];
            return MapObjectSelection.availableColors[id];
        } else {
            return MapObjectSelection.availableColors[
                sels.length % MapObjectSelection.availableColors.length
            ];
        }
    }

    removeSelection = function(sel: MapObjectSelection) {
        if (sel) {
            if (sel === this._activeSelection) {
                this.activeSelection = null;
            }
            sel.removeFromMap(this.viewport.map);
            var selections = this.getSelectionsForType(sel.mapObjectType);
            selections.splice(selections.indexOf(sel), 1);
        } else {
            console.log('Trying to delete nonexistant selection with id ' + sel.id);
        }
    };

    private _isValidType(t: string) {
        if (t === undefined || this._selectionsByType[t] === undefined) {
            console.log('Not a valid type: ', t);
            return false;
        } else {
            return true;
        }
    }

    serialize() {
        var $q = $injector.get<ng.IQService>('$q');
        var selectionPromisesPerType = {};
        // For all the selections of each type
        for (var type in this._selectionsByType) {
            var selections = this._selectionsByType[type];
            // serialize each selection individually
            var promises = _(selections).map((sel) => { return sel.serialize(); });
            // and wrap all the individual promises inside an `all`-promise.
            selectionPromisesPerType[type] = $q.all(promises);
        }
        // When all of the promises are resolved create the serialized
        // mapObjectSelectionHandler.
        return $q.all(<any>selectionPromisesPerType).then((selections) => {
            var ser = {
                activeSelectionId: this._activeSelection === null ? -1 : this._activeSelection.id,
                selections: selections
            };
            return ser;
        });
    }
}
