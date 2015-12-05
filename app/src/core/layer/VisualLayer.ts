/**
 * A short descriptor of the type content that is visualized with this
 * VisualLayer. The UI might choose to differentiate between layers of
 * different content types.
 * On Viewport all VisualLayers are stored within the same container.
 */
enum ContentType {mapObject, result, default};

/**
 * Optional arguments for the VisualLayer constructor.
 */
interface VisualLayerOpts {
    visuals?: Visual[];
    visible?: boolean;
    contentType?: ContentType;
}

/**
 * Layer class for Visuals, i.e. visualizable objects.
 * This is a wrapper around an openlayers vector layer.
 */
class VisualLayer extends BaseLayer<ol.layer.Vector> {

    contentType: ContentType;

    private _visuals: Visual[] = [];

    constructor(name: string, opt: VisualLayerOpts = {}) {
        super(name);

        var vectorSource = new ol.source.Vector({
            features: []
        });

        this._olLayer = new ol.layer.Vector({
            source: vectorSource,
            // style: styleFunction,
            visible: opt.visible === undefined ? true : false
        });

        if (opt.visuals !== undefined) {
            this.addVisuals(opt.visuals);
        }

        this.contentType = opt.contentType || ContentType.default;
    }

    get visuals() {
        return this._visuals;
    }

    addVisual(v: Visual) {
        if (v !== undefined && v !== null) {
            this._visuals.push(v);
            var src = this._olLayer.getSource();
            var feat = v.olFeature
            src.addFeature(feat);
        } else {
            console.log('Warning: trying to add undefined or null Visual.');
        }
    }

    addVisuals(vs: Visual[]) {
        var visuals = [];
        vs.forEach((v) => {
            if (v !== undefined && v !== null) {
                visuals.push(v);
            } else {
                console.log('Warning: trying to add undefined or null Visual.');
            }
        });
        visuals.forEach((v) => {
            this._visuals.push(v);
        });
        var features = _(visuals).map((v) => {
            var feat = v.olFeature;
            console.log(feat);
            return feat;
        });
        this._olLayer.getSource().addFeatures(features);
    }
}
