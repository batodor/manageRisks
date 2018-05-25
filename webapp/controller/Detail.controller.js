/*global location */
sap.ui.define([
		"managerisks/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"managerisks/model/formatter"
	], function (BaseController, JSONModel, formatter) {
		"use strict";

		return BaseController.extend("managerisks.controller.Detail", {

			formatter: formatter,

			/* =========================================================== */
			/* lifecycle methods                                           */
			/* =========================================================== */

			onInit : function () {
				// Model used to manipulate control states. The chosen values make sure,
				// detail page is busy indication immediately so there is no break in
				// between the busy indication for loading the view's meta data
				var oViewModel = new JSONModel({
					delay : 0,
					lineItemListTitle : this.getResourceBundle().getText("detailLineItemTableHeading")
				});

				this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

				this.setModel(oViewModel, "detailView");

				this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
			},

			/* =========================================================== */
			/* event handlers                                              */
			/* =========================================================== */

			/**
			 * Event handler when the share by E-Mail button has been clicked
			 * @public
			 */
			onShareEmailPress : function () {
				var oViewModel = this.getModel("detailView");

				sap.m.URLHelper.triggerEmail(
					null,
					oViewModel.getProperty("/shareSendEmailSubject"),
					oViewModel.getProperty("/shareSendEmailMessage")
				);
			},

			/**
			 * Event handler when the share in JAM button has been clicked
			 * @public
			 */
			onShareInJamPress : function () {
				var oViewModel = this.getModel("detailView"),
					oShareDialog = sap.ui.getCore().createComponent({
						name : "sap.collaboration.components.fiori.sharing.dialog",
						settings : {
							object :{
								id : location.href,
								share : oViewModel.getProperty("/shareOnJamTitle")
							}
						}
					});

				oShareDialog.open();
			},

			/**
			 * Updates the item count within the line item table's header
			 * @param {object} oEvent an event containing the total number of items in the list
			 * @private
			 */
			onUpdateFinished : function (oEvent) {
				var id = oEvent.getSource().data("id"),
					sTitle = this.byId(id + "Title"),
					iTotalItems = oEvent.getParameter("total"),
					oTable = this.byId(id + "Table");

				// only update the counter if the length is final
				if (oTable.getBinding("items").isLengthFinal()) {
					sTitle.setText(this.getResourceBundle().getText(id + "Title", [iTotalItems]));
				}
			},

			/* =========================================================== */
			/* begin: internal methods                                     */
			/* =========================================================== */

			/**
			 * Binds the view to the object path and expands the aggregated line items.
			 * @function
			 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
			 * @private
			 */
			_onObjectMatched : function (oEvent) {
				var risks = this.byId('risksFragment');
				var limits = this.byId('limitsFragment');
				risks.setVisible(false);
				limits.setVisible(false);
				var TCNumber =  oEvent.getParameter("arguments").TCNumber;
				var ItemType = oEvent.getParameter("arguments").ItemType;
				this.getModel().metadataLoaded().then( function() {
					var sObjectPath = this.getModel().createKey("/DealSet", {
						TCNumber : TCNumber,
						ItemType : ItemType
					});
					if(ItemType === "R"){
						risks.setVisible(true);
						this.bindTable("risksTable", sObjectPath + "/ToRisksCounterparty");
						this.bindTable("risksCountryTable", sObjectPath + "/ToRisksCountry");
					}else if(ItemType === "L"){
						limits.setVisible(true);
						this.bindElement("ratingElement", sObjectPath + "/ToCounterpartyRating", true);
						//this.bindTable("limits1Table", sObjectPath + "/ToRisksCounterparty");
						//this.bindTable("limits2Table", sObjectPath + "/ToRisksCountry");
					}
					
					
				}.bind(this));
			},
			
			// Bind table function for all tables
			// tableId = id of table, url = full path of binding
			bindTable: function(id, url){
				var oTable = this.byId(id, url);
				if(oTable["mBindingInfos"].items.path !== url){
					oTable.bindItems({
						path: url,
						template: oTable['mBindingInfos'].items.template
					});
				}
			},
			
			// Bind element function for all elements
			// tableId = id of element, url = full path of binding, update = flag if the operation is update
			bindElement: function(elementId, url, update){
				var oElement = this.byId(elementId);
				if(Object.keys(oElement.mElementBindingContexts).length === 0 || update){
					oElement.bindElement(url);
				}
			},

			_onBindingChange : function () {
				var oView = this.getView(),
					oElementBinding = oView.getElementBinding();

				// No data for the binding
				if (!oElementBinding.getBoundContext()) {
					this.getRouter().getTargets().display("detailObjectNotFound");
					// if object could not be found, the selection in the master list
					// does not make sense anymore.
					this.getOwnerComponent().oListSelector.clearMasterListSelection();
					return;
				}

				var sPath = oElementBinding.getPath(),
					oResourceBundle = this.getResourceBundle(),
					oObject = oView.getModel().getObject(sPath),
					sObjectId = oObject.Code,
					sObjectName = oObject.Name,
					oViewModel = this.getModel("detailView");

				this.getOwnerComponent().oListSelector.selectAListItem(sPath);

				oViewModel.setProperty("/saveAsTileTitle",oResourceBundle.getText("shareSaveTileAppTitle", [sObjectName]));
				oViewModel.setProperty("/shareOnJamTitle", sObjectName);
				oViewModel.setProperty("/shareSendEmailSubject",
					oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
				oViewModel.setProperty("/shareSendEmailMessage",
					oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
			},

			_onMetadataLoaded : function () {
				// Store original busy indicator delay for the detail view
				var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
					oViewModel = this.getModel("detailView"),
					oLineItemTable = this.byId("risksTable"),
					iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

				// Make sure busy indicator is displayed immediately when
				// detail view is displayed for the first time
				oViewModel.setProperty("/delay", 0);
				oViewModel.setProperty("/lineItemTableDelay", 0);

				oLineItemTable.attachEventOnce("updateFinished", function() {
					// Restore original busy indicator delay for line item table
					oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
				});

				// Binding the view will set it to not busy - so the view is always busy if it is not bound
				oViewModel.setProperty("/busy", true);
				// Restore original busy indicator delay for the detail view
				oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
			}

		});

	}
);