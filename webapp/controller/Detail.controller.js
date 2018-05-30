/*global location */
sap.ui.define([
		"managerisks/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"managerisks/model/formatter",
		'sap/m/MessageToast',
		'sap/m/MessageBox'
	], function (BaseController, JSONModel, formatter, MessageToast, MessageBox) {
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
				
				this.risksDialog = sap.ui.xmlfragment("fragment.risksDialog", this);
				this.getView().addDependent(this.risksDialog);
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
				this.TCNumber =  oEvent.getParameter("arguments").TCNumber;
				this.ItemType = oEvent.getParameter("arguments").ItemType;
				this.getModel().metadataLoaded().then( function() {
					var sObjectPath = this.getModel().createKey("/DealSet", {
						TCNumber : this.TCNumber,
						ItemType : this.ItemType
					});
					if(this.ItemType === "R"){
						risks.setVisible(true);
						this.bindTable("risksTable", sObjectPath + "/ToRisksCounterparty");
						this.bindTable("risksCountryTable", sObjectPath + "/ToRisksCountry");
					}else if(this.ItemType === "L"){
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
			
			gotoBP: function(oEvent){
				var counterParty = oEvent.getSource().data("key");
				window.open("https://ws-ere.corp.suek.ru/sap/bc/ui2/flp#ZTS_BUSINESS_PARTNER-display&/CounterpartyHeaderSet/" + counterParty);
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
			},
			
			approve: function(){
				if(this.ItemType === "R"){
					var oFuncParams = { 
						TCNumber: this.TCNumber
					};
					this.getModel().callFunction("/ApproveRisks", {
						method: "POST",
						urlParameters: oFuncParams,
						success: this.onRisksApproveSuccess.bind(this)
					});
				}else{
					MessageToast.show("Limits will work tommorow!");
				}
			},
			
			onRisksApproveSuccess: function(oData, response) {
				var oResult = oData.ApproveRisks;
				if (oResult.ActionSuccessful) {
					MessageToast.show(oResult.Message);
					var eventBus = sap.ui.getCore().getEventBus();
					eventBus.publish("DetailMasterChannel", "onApproveEvent");
				} else {
					MessageBox.error(oResult.Message);
				}
			},
			
			onTableClick: function(oEvent){
				var oContext = oEvent.getParameters("listItem").listItem.getBindingContext();
				var path = oContext.getPath();
				var data = oContext.getModel().getData(path);
				var id = oEvent.getSource().data("id");
				var oDialog = sap.ui.getCore().byId(id + "Dialog");
				oDialog.unbindElement();
				oDialog.setTitle(data.CounterpartyName);
				oDialog.bindElement(path);
				this.risksDialog.open();
			},
			
			dialogClose: function(oEvent){
				var id = oEvent.getSource().data("id");
				this.byId(id + "Table").removeSelections();
				this[id + "Dialog"].close();
			},
			
			dialogSave: function(oEvent){
				var id = oEvent.getSource().data("id");
				var dialog = sap.ui.getCore().byId(id + "Dialog");
				var url = dialog.getBindingContext().getPath();
				var inputData = this.getOdata(dialog);
				var modelData = dialog.getModel().getData(url);
				var changedData = this.compareDatas(inputData, modelData);
				dialog.unbindElement();
				dialog.getModel().update(url, changedData);
				this.dialogClose(oEvent);
			},
			
			// Set odata from any dialog, oDialog = object dialog / return object Data
			getOdata: function(oDialog){
				var oData = {};
				var inputs = oDialog.getAggregation("content");
				var typeArr = ["value", "dateValue", "selectedKey", "selected"];
				for(var i in inputs){
					var input = inputs[i];
					for(var j in typeArr){
						var type = typeArr[j];
						if(input.getBindingInfo(type)){
							var value = input.getProperty(type);
							var name = input.getBindingInfo(type).binding.sPath;
							oData[name] = value;
						}
					}
				}
				return oData;
			},
			
			// Compare input and model datas
			// outputs only modified data
			compareDatas: function(inputData, modelData){
				var keys = Object.keys(inputData);
				var changedData = {};
				for(var i in keys){
					if(inputData[keys[i]] !== modelData[keys[i]]){
						changedData[keys[i]] = inputData[keys[i]];
					}
				}
				return changedData;
			}

		});

	}
);