import React, { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{children:ReactNode;graph?:boolean},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div className={this.props.graph?'grapharea viewerror':'viewerror'} role="alert"><h2>This view couldn’t load.</h2><p>{this.props.graph?'You can still explore using the topic and connection lists.':'Your current link is preserved. Refresh to try opening it again.'}</p><button onClick={()=>location.reload()}>Refresh this page</button><a href="/">Return to discovery</a></div>:this.props.children}
}
