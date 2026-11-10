import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, StylesheetStyle } from 'cytoscape';
import { Maximize, Minus, Network, Plus, RotateCcw } from 'lucide-react';
import type { Edge, Entity, Graph } from './exploration';

type Props = {graph:Graph;filter:string;light:boolean;selectedId?:string;routeIds?:string[];onSelect:(entity:Entity)=>void;onInspect:(edge:Edge)=>void;onReset:()=>void};
function styles(light:boolean, showLabels:boolean):StylesheetStyle[]{return [
 {selector:'node',style:{label:'data(label)',color:light?'#152726':'#e6ede8','background-color':'#79ab97','border-width':2,'border-color':'#203f35','font-size':12,'text-valign':'bottom','text-margin-y':10,width:30,height:30,'text-wrap':'wrap','text-max-width':'125px'}},
 {selector:'node[root = 1]',style:{width:60,height:60,'background-color':'#c2edab','border-color':'#c2edab','font-size':16}},
 {selector:'node:selected',style:{'border-color':light?'#3c652d':'#f2ffe5','border-width':4}},
 {selector:'edge',style:{width:1,'line-color':light?'#718f7c':'#4e6d5e','target-arrow-color':'#718d80','target-arrow-shape':'triangle','curve-style':'bezier',label:showLabels?'data(label)':'','font-size':10,color:light?'#354c40':'#afc0b5','text-background-color':light?'#ecf1e9':'#10201b','text-background-opacity':1,'text-background-padding':'4px','text-rotation':'autorotate'}},
 {selector:'edge.traced-route',style:{width:3,'line-color':light?'#2e7d5b':'#aee89a','target-arrow-color':light?'#2e7d5b':'#aee89a'}}
]}
export default function GraphCanvas(props:Props){
 const canvas=useRef<HTMLDivElement>(null),cy=useRef<Core|null>(null),latest=useRef(props);
 latest.current=props;
 const [labelPreference,setLabelPreference]=useState<boolean|null>(null);
 const visibleEdges=props.graph.edges.filter(edge=>props.filter==='all'||edge.property_id===props.filter);
 const showLabels=labelPreference??visibleEdges.length<=36;
 useEffect(()=>{
  if(!canvas.current)return;
  const c=cytoscape({container:canvas.current,minZoom:.25,maxZoom:3,selectionType:'single'});cy.current=c;
  c.on('tap','node',event=>{const node=latest.current.graph.nodes.find(n=>n.id===event.target.id());if(node)latest.current.onSelect(node)});
  c.on('tap','edge',event=>{const edge=latest.current.graph.edges.find(e=>e.id===event.target.id());if(edge)latest.current.onInspect(edge)});
  const observer=new ResizeObserver(()=>c.resize());observer.observe(canvas.current);
  return()=>{observer.disconnect();c.destroy();cy.current=null};
 },[]);
 useEffect(()=>{cy.current?.style(styles(props.light,showLabels))},[props.light,showLabels]);
 useEffect(()=>{
  const c=cy.current;if(!c)return;
  c.batch(()=>{c.elements().remove();c.add([...props.graph.nodes.map(n=>({data:{id:n.id,label:n.label,root:n.id===props.graph.root_id?1:0}})),...props.graph.edges.filter(e=>props.filter==='all'||e.property_id===props.filter).map(e=>({data:{id:e.id,source:e.source,target:e.target,label:e.label}}))])});
  c.layout({name:'concentric',concentric:n=>n.id()===props.graph.root_id?10:Math.min(n.degree(),6),levelWidth:()=>1,minNodeSpacing:65,animate:false,padding:50}).run();
 },[props.graph,props.filter]);
 useEffect(()=>{const c=cy.current;if(!c||!props.selectedId)return;c.nodes().unselect();const node=c.$id(props.selectedId);node.select();const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if(reduced)c.center(node);else c.animate({center:{eles:node},duration:150})},[props.selectedId,props.graph,props.filter]);
 useEffect(()=>{
  const c=cy.current;
  if(!c)return;
  c.edges().removeClass('traced-route');
  for(const id of props.routeIds??[]) c.$id(id).addClass('traced-route');
 },[props.routeIds,props.graph,props.filter]);
 function zoom(factor:number){const c=cy.current;if(c)c.zoom(c.zoom()*factor)}
 return <div className="grapharea"><div className="graphmeta"><Network size={15}/>{props.graph.nodes.length} topics · {visibleEdges.length} connections <span>{props.graph.offline?'OFFLINE COLLECTION':props.graph.saved_edge_ids?.length?'WIKIDATA + SAVED LINKS':'WIKIDATA'}</span></div><div className="canvas" ref={canvas} role="group" tabIndex={0} aria-label="Knowledge graph" aria-describedby="graph-help" onKeyDown={event=>{
  if(event.target!==event.currentTarget)return;
  const nodes=props.graph.nodes;const index=nodes.findIndex(n=>n.id===props.selectedId);
  if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(event.key)&&nodes.length){event.preventDefault();const direction=['ArrowRight','ArrowDown'].includes(event.key)?1:-1;props.onSelect(nodes[(Math.max(index,0)+direction+nodes.length)%nodes.length])}
  if(event.key==='Enter'&&index>=0){event.preventDefault();props.onSelect(nodes[index])}
  if(['+','=','-','0'].includes(event.key)){event.preventDefault();if(event.key==='0')cy.current?.fit(undefined,50);else zoom(event.key==='-'?1/1.2:1.2)}
 }}/><p id="graph-help" className="sr-only">Use arrow keys to select topics and read their profiles. Plus and minus zoom; zero fits the graph. The topic and connection lists provide equivalent controls.</p><span className="sr-only" role="status">Selected topic: {props.graph.nodes.find(n=>n.id===props.selectedId)?.label}</span><div className="graphcontrols"><button aria-label="Zoom in" onClick={()=>zoom(1.2)}><Plus size={18}/></button><button aria-label="Zoom out" onClick={()=>zoom(1/1.2)}><Minus size={18}/></button><button aria-label="Fit graph" onClick={()=>cy.current?.fit(undefined,50)}><Maximize size={18}/></button><button aria-label="Reset graph" onClick={props.onReset}><RotateCcw size={18}/></button></div><label className="edge-label-control"><input type="checkbox" checked={showLabels} onChange={e=>setLabelPreference(e.target.checked)}/> Edge labels</label><div className="canvasnote">Arrow keys select · drag to pan · scroll to zoom</div></div>
}
