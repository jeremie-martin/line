/** Concrete gallery choices, not a new specification language. The same search
 * evaluates every arc variant's emitted collision geometry. */
import type {ArcMotionOptions} from '../v0/optimizer/arc_motion.ts';
type GeometryOptions=Pick<ArcMotionOptions,'profile'|'contour'|'wave'|'subdivisions'|'policyPreview'>;
type Method = {title:string;description:string;arc?:GeometryOptions};
export const galleryMethods = {
  arcs: {title:'Arcs and guides',description:'Smooth connected support curves with optional guides.',arc:{}},
  segments: {title:'Scattered · original',description:'The original velocity-feedback controller, retained as a comparison.'},
  scattered: {title:'Scattered · improved',description:'Tests measured contact fragments against the original scattered controller using the remaining allowance.'},
  waves: {title:'Wave curves',description:'A returning bend followed by an independently shaped exit.',arc:{wave:true,policyPreview:false}},
  facets: {title:'Faceted curves',description:'Long straight faces, searched with their actual angular geometry.',arc:{subdivisions:.5,policyPreview:false}},
  serpentine: {title:'Serpentine rails',description:'One broad S-shaped sweep: the curve bends one way, then the other.',arc:{profile:'serpentine',policyPreview:false}},
  terraces: {title:'Terraced rails',description:'Two eased steps interrupt the slope, making ledges and rounded transitions.',arc:{profile:'terraces',policyPreview:false}},
  scallops: {title:'Ripple rails',description:'Two successive waves along the support, creating a repeating undulation.',arc:{profile:'scallops',policyPreview:false}},
  ribbon: {title:'Ribbed ribbons',description:'Curved bands divided by ribs. All outer edges and ribs are physical normal lines, present during search.',arc:{contour:'ribbon',policyPreview:false}},
  teeth: {title:'Crystal teeth',description:'Triangular teeth grow away from the supporting rail and its guide. The complete structure participates in physics.',arc:{contour:'teeth',policyPreview:false}},
  petals: {title:'Petal chains',description:'Rounded lobes grow along the supporting curves, creating a repeating floral outline. Every edge is physical.',arc:{contour:'petals',policyPreview:false}},
} satisfies Record<string,Method>;
export type GalleryMethod=keyof typeof galleryMethods;
export const galleryMethodDetails=Object.fromEntries(Object.entries(galleryMethods).map(([id,{title,description}])=>[id,{title,description}]));
export function galleryArcOptions(method:GalleryMethod):GeometryOptions|undefined {
  if(!Object.hasOwn(galleryMethods,method))throw new Error(`unknown gallery method: ${method}`);
  const definition:Method=galleryMethods[method];
  return definition.arc;
}
