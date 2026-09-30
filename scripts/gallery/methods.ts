/** Concrete gallery choices, not a new specification language. The same search
 * evaluates every arc variant's emitted collision geometry. */
import type {ArcMotionOptions} from '../v0/optimizer/arc_motion.ts';
type GeometryOptions=Pick<ArcMotionOptions,'profile'|'profileStart'|'foldAngle'|'faces'|'contour'|'wave'|'subdivisions'>;
type GuideOptions=Pick<ArcMotionOptions,'pruneGuidance'|'guides'|'channel'>;
type SearchOptions=Pick<ArcMotionOptions,'policyPreview'>;
type ArcRecipe=GeometryOptions&GuideOptions&SearchOptions;
type Method = {title:string;description:string;geometry?:GeometryOptions;guidance?:GuideOptions;search?:SearchOptions;archived?:boolean;studyOnly?:boolean};
export const galleryMethods = {
  arcs: {title:'Arcs and guides',description:'Smooth connected support curves with optional guides.',geometry:{}},
  single: {studyOnly:true,title:'Single rail',description:'Each main curve is searched with opposing guides disabled from the outset, against the same motion and timing targets.',geometry:{},guidance:{guides:false,channel:0}},
  paired: {title:'Paired rails',description:'Plain support curves with their full opposing guides retained from near the start of each support. Both rails participate in the physics search; unused guide sections remain visible.',geometry:{},guidance:{pruneGuidance:false}},
  segments: {title:'Scattered · original',description:'The original velocity-feedback controller, retained as a comparison.'},
  scattered: {title:'Scattered · improved',description:'Tests measured contact fragments against the original scattered controller using the remaining allowance.'},
  waves: {title:'Wave curves',description:'A returning bend followed by an independently shaped exit.',geometry:{wave:true},search:{policyPreview:false}},
  facets: {title:'Faceted curves',description:'Long straight faces, searched with their actual angular geometry.',geometry:{subdivisions:.5},search:{policyPreview:false}},
  fold: {studyOnly:true,title:'Folded rails',description:'Three long faces with a steeper middle face. The complete connected geometry participates in physical search.',geometry:{profile:'fold',profileStart:0,faces:3,foldAngle:30},search:{policyPreview:false}},
  serpentine: {title:'Serpentine rails',description:'One broad S-shaped sweep: the curve bends one way, then the other.',geometry:{profile:'serpentine'},search:{policyPreview:false}},
  terraces: {title:'Terraced rails',description:'Two eased steps interrupt the slope, making ledges and rounded transitions.',geometry:{profile:'terraces'},search:{policyPreview:false}},
  scallops: {title:'Ripple rails',description:'Two successive waves along the support, creating a repeating undulation.',geometry:{profile:'scallops'},search:{policyPreview:false}},
  ribbon: {archived:true,title:'Ribbed ribbons',description:'Curved bands divided by ribs. All outer edges and ribs are physical normal lines, present during search.',geometry:{contour:'ribbon'},search:{policyPreview:false}},
  teeth: {archived:true,title:'Crystal teeth',description:'Triangular teeth grow away from the supporting rail and its guide. The complete structure participates in physics.',geometry:{contour:'teeth'},search:{policyPreview:false}},
  petals: {archived:true,title:'Petal chains',description:'Rounded lobes grow along the supporting curves, creating a repeating floral outline. Every edge is physical.',geometry:{contour:'petals'},search:{policyPreview:false}},
} satisfies Record<string,Method>;
export type GalleryMethod=keyof typeof galleryMethods;
export const galleryActiveMethods=Object.keys(galleryMethods).filter(id=>!(galleryMethods[id as GalleryMethod] as Method).archived && !(galleryMethods[id as GalleryMethod] as Method).studyOnly) as GalleryMethod[];
export const galleryMethodDetails=Object.fromEntries(Object.entries(galleryMethods).map(([id,definition])=>{
  const {title,description,geometry,guidance,search}=definition as Method;
  return [id,{title,description,railLayout:geometry?(geometry.contour?'contours':'connected'):'fragments',settings:geometry?{geometry,guidance:guidance??{},search:search??{}}:undefined}];
}));
export function galleryArcOptions(method:GalleryMethod):ArcRecipe|undefined {
  if(!Object.hasOwn(galleryMethods,method))throw new Error(`unknown gallery method: ${method}`);
  const definition:Method=galleryMethods[method];
  return definition.geometry?{...definition.geometry,...definition.guidance,...definition.search}:undefined;
}
