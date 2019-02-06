import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';

import AppBar from '@material-ui/core/AppBar';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Checkbox from '@material-ui/core/Checkbox';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';

import AirTower from '../network/AirTower';

import FrameComponent from '../frame/Frame';

import TimelineComponent from '../components/Timeline';
import Video from '../components/Video';
import VideoControls from '../components/VideoControls';

const styles = theme => ({
	button: {
		margin: theme.spacing.unit,
	},
});


class Edit extends Component {

	state = {
		importObj: null,
		currentTime: 0,
		video: {
			playing: false
		},
		slate: false,
		frame: false,
		videoTitle: null,
		platforms: {},
		subview: null,
		renderState: []
	}

	platforms = {
		youtube: {
			slate: true,
			frame: false
		},
		facebook: {
			slate: true,
			frame: true
		},
		twitter: {
			slate: true,
			frame: true
		},
		instagram: {
			slate: false,
			frame: true
		}
	}

	componentWillMount () {
		this.loadImport();
		this.loadRenderState();

		// Transform available platforms into a state object that holds whether or not they are enabled
		let platforms = Object.assign({}, this.platforms);
		for (var i in platforms) {
			platforms[i] = Object.assign({}, platforms[i]);
			for (var j in platforms[i]) {
				platforms[i][j] = false;
			}
		}

		this.setState({
			platforms: platforms
		})

		this.interval = setInterval(() => {

			if (!this.video) {
				return;
			}

			if (this.video.getTimecode() == 0) {
				return;
			}

			if (this.video.getTimecode() >= this.state.importObj.end_time) {
				this.video.pause();
				this.video.seekStart();
			}

			this.setState({
				currentTime: this.video.getTimecode(),
			});


		}, 100);
	}

	componentWillUnmount () {
		clearInterval(this.interval);
	}

	getServiceName () {
		return 'video';
	}

	getImportID () {
		return this.props.match.params.id;
	}

	loadImport () {
		let airTower = AirTower.getInstance();
		airTower.ingest.findImportByID(this.getServiceName(), this.getImportID())
			.then((importObj) => {
				this.setState({
					importObj: importObj
				})
			})
			.then(() => {
				
			})

		airTower.core.findImportByID(this.getImportID())
			.then((coreImportObj) => {
				this.setState({
					coreImportObj: coreImportObj
				}, () => this.checkForVideos());
			})
			.catch((error) => {
				console.log('error finding', error)
					.then((coreImportObj) => {
						this.setState({
							coreImportObj: coreImportObj
						}, () => this.checkForVideos());
					})
			})
	}

	loadRenderState () {
		let airTower = AirTower.getInstance();

		airTower.core.loadRenderState(this.getImportID())
			.then((renderState) => {
				this.setState({
					renderState: renderState
				})
				if (renderState.length > 0) {
					setTimeout(this.loadRenderState.bind(this), 5000);
				}
			});
	}

	// Based on what videos exist on the backend, check the relevant boxes to show that they exist. 
	checkForVideos () {
		let videos = this.state.coreImportObj.videos;

		let enabledState = {};
		for (var i = 0; i < videos.length; i++) {
			enabledState[videos[i].type] = true;
		}

		this.setState(enabledState);
	}

	getEnabledVideoTypes () {
		let types = ['default', 'slate', 'frame'];
		return types.filter((a) => this.state[a] == true);
	}

	checkAndCreateVideos () {
		let required = this.getEnabledVideoTypes(); 
		let videos = this.state.coreImportObj.videos;

		let airTower = AirTower.getInstance();
		for (var i = 0; i < videos.length; i++) {
			if (required.includes(videos[i].type)) {
				required = required.filter((a) => a != videos[i].type)
			} else {
				// no longer required, delete this!
				airTower.core.deleteVideoById(this.getImportID(), videos[i].id)
					.then((coreImportObj) => {
						this.setState({
							coreImportObj: coreImportObj
						})
					})
			}
		}

		for (var i = 0; i < required.length; i++) {
			airTower.core.createVideoByType(this.getImportID(), required[i])
				.then((coreImportObj) => {
					this.setState({
						coreImportObj: coreImportObj
					})
				})
		}
	}

	findVideoForType (type) {
		return this.state.coreImportObj.videos.find((video) => video.type == type);
	}

	onTimelineUpdate (timecode) {
		this.video.setTimecode(timecode);
	}

	setVideo (video) {
		this.video = video;
	}

	setVideoState (state) {
		this.setState({
			video: state
		})
	}

	getVideoSRC () {
		return this.state.importObj.getPreviewPath();
	}

	updateLocalField (field, event) {
		this.setState({
			[field]:  event.target[event.target.hasOwnProperty('checked') ? 'checked' : 'value']
		}, () => this.checkAndCreateVideos());
	}

	updatePlatform (platform, type, event) {
		this.setState({
			platforms: Object.assign({}, this.state.platforms, {
				[platform]: Object.assign({}, this.state.platforms[platform], {
					[type]: event.target.checked
				})
			})
		})
	}

	openSubView (url) {
		if (this.props.location.pathname.substr(-1, 1) == '/') {
			this.props.history.replace(this.props.location.pathname + url)
		} else {
			this.props.history.replace(this.props.location.pathname + '/' + url)
		}
	}

	closeSubView (type, saveData) {
		if (saveData != undefined) {
			let data = saveData();
			this.saveConfiguration(type, data);
		}

		this.props.history.replace(this.props.location.pathname + '/..')
	}

	save () {
		let airTower = AirTower.getInstance();
		airTower.core.takeOwnership(this.getServiceName(), this.getImportID(), this.state.videoTitle)
			.then((coreImportObj) => {
				coreImportObj.set('title', this.state.videoTitle);
				this.setState({
					coreImportObj: this.state.coreImportObj
				})
			})
	}

	sendRender () {

	}

	downloadRawVideo () {

	}

	/**
	 * For a child video, save its configuration
	 */
	saveConfiguration (type, data) {
		let airTower = AirTower.getInstance();
		let videoID = this.findVideoForType(type).id;

		airTower.core.updateVideo(this.getImportID(), videoID, data)
			.then((coreImportObj) => {
				this.setState({
					coreImportObj: coreImportObj
				})
			})
	}

	getStyleFor (renderType) {
		let styles = ['selectionCardContainer'], video = this.findVideoForType(renderType);

		if (video != null && (video.queued || video.rendering)) {
			styles.push('rendering');
			styles.push('render-state-' + this.getRenderStateClass(video.id));
		}

		return styles.join(' ');
	}

	getRenderStateClass (videoID) {
		let renderState = this.state.renderState.find((state) => state.video_id == videoID);
		if (!renderState) {
			return 'none';
		}
		return renderState.status;
	}

	getRenderProgress (renderType) {
		let video = this.findVideoForType(renderType);

		let renderState = this.state.renderState.find((state) => state.video_id == video.id);

		if (!renderState) {
			return 0;
		}

		return renderState.level;
	}

	render () {

		if (!this.state.importObj || !this.state.coreImportObj) {
			return (<b>loading</b>);
		}

		let urlParamArgument = this.props.location.pathname.split('/').pop()

		switch (urlParamArgument) {
			case 'frame':
				return <FrameComponent
					importObj={ this.state.importObj }
					coreImportObj={ this.state.coreImportObj }
					previewSRC={ this.getVideoSRC() }
					initialState={ this.findVideoForType('frame').configuration }
					saveAndClose={ this.closeSubView.bind(this, 'frame') } />

		}

		return (

			<div className="fullpage">
				<div className="video-container">
					<div className="video-player fit">
						<div className="video-player-video-element">
							<Video
								ref={ (v) => this.setVideo(v) }
								onStateChange={ (state) => this.setVideoState(state) }
								hls={ true }
								src={ this.getVideoSRC() }
								segmentStart = { this.state.importObj.start_time }
								segmentEnd = { this.state.importObj.end_time } />
						</div>
					</div>

					<VideoControls video={ this.video } videoState={ this.state.video } />

					<div className="video-timeline">
						
						<TimelineComponent
							start={ this.state.importObj.start_time }
							end={ this.state.importObj.end_time }
							offset={ this.state.currentTime }
							onChange={ this.onTimelineUpdate.bind(this) }
							segmentStart = { this.state.importObj.start_time }
							segmentEnd = { this.state.importObj.end_time }
							autoUpdateViewport={ true }
							readOnly={ true }
							initialOffset={ 0 } />

					</div>

				</div>

				<div className="video-side">
					<div className="video-selector">
						<AppBar position="static">
							<Toolbar>
								<div style={{ flex: 1 }}>
									<TextField
										fullWidth={ true }
										defaultValue={ this.state.coreImportObj.title || 'Untitled' }
										value={ this.state.videoTitle }
										onChange={ this.updateLocalField.bind(this, 'videoTitle') }
										margin="normal" />
								</div>
								<IconButton color="inherit" aria-label="Menu" onClick={ this.save.bind(this) }>
									S
								</IconButton>
							</Toolbar>
						</AppBar>

						<div className="side-content">

							<Typography variant="h5" component="h2">
								Target Platforms
							</Typography>

							<Card className={ this.getStyleFor('slate') }>
								<div className="selectionCard">
									<div className="rendering-progress">
										<div
											className="rendering-progress-element"
											style={{ width: this.getRenderProgress('slate') + '%' }}>
										</div>
										<p>Render Message</p>
									</div>
									<CardActions>
										<Checkbox
											checked={ this.state.slate }
											onChange={ this.updateLocalField.bind(this, 'slate') }
											color="primary" />
									</CardActions>
									<CardContent>
										<Typography variant="h5" component="h2">
											Linear Video
											&nbsp;&nbsp;
											<Button>Edit</Button>
										</Typography>

										<p>
											Select platforms to share on
										</p>

										<FormGroup>
											<FormControlLabel
												control={
													<Checkbox
														checked={ this.state.platforms.youtube.slate }
														onChange={ this.updatePlatform.bind(this, 'youtube', 'slate') } />
												}
												label="YouTube" />
											<FormControlLabel
												control={
													<Checkbox
														checked={ this.state.platforms.facebook.slate }
														onChange={ this.updatePlatform.bind(this, 'facebook', 'slate') } />
												}
												label="Facebook" />
											<FormControlLabel
												control={
													<Checkbox
														checked={ this.state.platforms.twitter.slate }
														onChange={ this.updatePlatform.bind(this, 'twitter', 'slate') } />
												}
												label="Twitter" />
										</FormGroup>

									</CardContent>
								</div>
							</Card>

							<Card className="selectionCardContainer">
								<div className="selectionCard">
									<CardActions>
										<Checkbox
											checked={ this.state.frame }
											onChange={ this.updateLocalField.bind(this, 'frame') }
											color="primary" />
									</CardActions>
									<CardContent>
										<Typography variant="h5" component="h2">
											Square Video
											&nbsp;&nbsp;
											<Button onClick={ this.openSubView.bind(this, 'frame') }>
												Edit
											</Button>
										</Typography>

										<p>
											Select platforms to share on
										</p>

										<FormGroup>
											<FormControlLabel
												control={
													<Checkbox
														checked={ this.state.platforms.facebook.frame }
														onChange={ this.updatePlatform.bind(this, 'facebook', 'frame') } />
												}
												label="Facebook" />
											<FormControlLabel
												control={
													<Checkbox
														checked={ this.state.platforms.twitter.frame }
														onChange={ this.updatePlatform.bind(this, 'twitter', 'frame') } />
												}
												label="Twitter" />
											<FormControlLabel
												control={
													<Checkbox
														checked={ this.state.platforms.instagram.frame }
														onChange={ this.updatePlatform.bind(this, 'instagram', 'frame') } />
												}
												label="Instagram" />
										</FormGroup>

									</CardContent>
								</div>
							</Card>

							<Button
									variant="contained"
									color="secondary"
									fullWidth={ true }
									onClick={ this.sendRender.bind(this) }
									className="padded-button">
								Export &amp; Share
							</Button>

							<p className="small-text">Rendering may take a few minutes and is dependent on available server resources</p>

							<Button
									variant="contained"
									color="primary"
									fullWidth={ true }
									onClick={ this.downloadRawVideo.bind(this) }
									className="padded-button">
								Download Raw Video
							</Button>

						</div>
					</div>
				</div>
			</div>
		);
	}
}

export default withStyles(styles)(Edit);
