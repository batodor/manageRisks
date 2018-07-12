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
				
				this.typeArr = ["value", "dateValue", "selectedKey", "selected"];

				this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

				this.setModel(oViewModel, "detailView");

				this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
				
				// Bind dialog to view
				this.risksDialog = sap.ui.xmlfragment("fragment.risksDialog", this);
				this.getView().addDependent(this.risksDialog);
				
				// Bind double click event
				this.byId("risksTable").ondblclick = this.onDoubleClick.bind(this, "risks");
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
				
				this.byId("page").setTitle(this.getResourceBundle().getText("detailTitle") + " " + this.TCNumber);
				this.byId("openDeal").setEnabled(true);
				
				this.getModel().metadataLoaded().then( function() {
					this.objectPath = this.getModel().createKey("/DealSet", {
						TCNumber : this.TCNumber,
						ItemType : this.ItemType
					});
					if(this.ItemType === "R"){
						risks.setVisible(true);
						this.bindTable("risksTable", this.objectPath + "/ToRisksCounterparty");
						this.bindTable("risksCountryTable", this.objectPath + "/ToRisksCountry");
					}else if(this.ItemType === "L"){
						limits.setVisible(true);
						this.byId("ratingElement").bindElement({
							path: this.objectPath + "/ToCounterpartyRating",
							events : {
								dataReceived : this.loadCurrentLimits.bind(this)
							}
						});
						//this.bindElement("ratingElement", this.objectPath + "/ToCounterpartyRating", true);
						this.bindElement("propertiesOfDeal", this.objectPath + "/ToPropertiesOfDeal", true);
						//this.bindTable("limitsTable", this.objectPath + "/ToCounterpartyRating/ToLimitsRating");
					}
				}.bind(this));
			},
			
			// Load current limits after counterparty rating loaded(ratingElement)
			loadCurrentLimits: function(oEvent){
				var url = this.objectPath + "/CounterpartyRatingSet(TCNumber='',Counterparty='',DateFrom=datetime'')";
				if(oEvent.getSource().oElementContext){
					url = oEvent.getSource().oElementContext.getPath();
				}
				this.bindTable("limitsTable", url + "/ToLimitsRating", true);
			},
			
			// Bind table function for all tables
			// tableId = id of table, url = full path of binding
			bindTable: function(id, url, update){
				var oTable = this.byId(id, url);
				if(oTable["mBindingInfos"].items.path !== url || update){
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
			
			openDeal: function(){
				window.open("https://ws-ere.corp.suek.ru/sap/bc/ui2/flp#ZTS_TC_DEAL-display?DealID=" + this.TCNumber);
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
			
			// Table buttons function for create/edit/copy/delete of items
			tableAdd: function(oEvent) {
				var id = oEvent.getSource().data("id");
				var dialog = this[id + "Dialog"];
				dialog.unbindElement();
				this.setEnabledDialog(dialog, true);
				sap.ui.getCore().byId(id + "EditContent").setVisible(false);
				var select = sap.ui.getCore().byId(id + "AddContent");
				select.setVisible(true).bindItems({
					path: this.objectPath + "/ToCounterpartyByDeal",
					template: select['mBindingInfos'].items.template
				});
				var buttons = dialog.getButtons();
				buttons[1].setVisible(true);
				buttons[2].setVisible(false);
				buttons[3].setVisible(false);
				dialog.open();
			},
			tableEdit: function(oEvent) {
				var id = oEvent.getSource().data("id");
				var dialog = this[id + "Dialog"];
				var url = this.byId(id + "Table").getSelectedItem().getBindingContextPath();
				dialog.bindElement(url);
				this.setEnabledDialog(dialog, false);
				sap.ui.getCore().byId(id + "EditContent").setVisible(true);
				sap.ui.getCore().byId(id + "AddContent").setVisible(false);
				var buttons = dialog.getButtons();
				buttons[1].setVisible(false);
				buttons[2].setVisible(false);
				buttons[3].setVisible(true).setEnabled(true);
				dialog.open();
			},
			tableDelete: function(oEvent) {
				var id = oEvent.getSource().data("id");
				var table = this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
				var url = table.getSelectedItem().getBindingContextPath();
				var oModel = table.getModel();
				MessageBox.confirm("Are you sure you want to delete?", {
					actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
					onClose: function(sAction) {
						if (sAction === "Delete") {
							oModel.remove(url);              
						} else {
							MessageToast.show("Delete canceled!");
						}
					}
				});
			},
			
			onTableClick: function(oEvent){
				var table = oEvent.getSource();
				var selectedCount = table.getSelectedItems().length;
				var id = table.data("id");
				if (selectedCount > 0) {
					this.setInputEnabled([id + "Delete", id + "Edit"], true);
				} else {
					this.setInputEnabled([id + "Delete", id + "Edit"], false);
				}
			},
			
			dialogCancel: function(oEvent){
				var id = oEvent.getSource().data("id");
				//this.byId(id + "Table").removeSelections();
				this[id + "Dialog"].close();
			},
			dialogAdd: function(oEvent) {
				var button = oEvent.getSource();
				var tableId = button.data("id");
				var dialog = button.getParent();
				var oModel = dialog.getModel();
				var oData = this.getOdata(dialog);
				var bCheckAlert = this.checkKeys(dialog);
				if(bCheckAlert === "Please, enter"){
					oModel.create("/" + tableId + "Set", oData);
					this[tableId + "Dialog"].close();
				}else{
					MessageBox.alert(bCheckAlert.slice(0, -2), {
						actions: [sap.m.MessageBox.Action.CLOSE]
					});
				}
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
			dialogEdit: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var dialog = sap.ui.getCore().byId(id + "Dialog");
				if(dialog.getButtons()[3].getEnabled()){
					this.setDisabledDialog(dialog);
					dialog.getButtons()[3].setEnabled(false);
				}else{
					this.setEnabledDialog(dialog, false);
					dialog.getButtons()[3].setEnabled(true);
				}
			},
			
			// Set odata from any dialog, argument oDialog = object dialog / return object inputs Data
			getOdata: function(dialog){
				var oData = {};
				var inputs = dialog.getAggregation("content");
				for(var i in inputs){
					var input = inputs[i];
					for(var j in this.typeArr){
						var type = this.typeArr[j];
						if(input.getBindingInfo(type)){
							var value = input.getProperty(type);
							var name = input.getBindingInfo(type).binding.sPath;
							if(input["mProperties"].hasOwnProperty("type") && input.getType() === "Number"){
								value = parseInt(value);
							}
							if(input.data("name")){
								name = input.data("name");
							}
							if(input.hasOwnProperty("_oMaxDate")){
								value = input.getDateValue();
								if(value) {
									value.setMinutes(-value.getTimezoneOffset());
								} else { 
									value = null;
								}
							}
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
			},
			
			// Enable/Disables inputs depending flag arg
			setInputEnabled: function(idArr, flag){
				for(var i in idArr){
					if(this.byId(idArr[i])){
						this.byId(idArr[i]).setEnabled(flag);
					}else if(sap.ui.getCore().byId(idArr[i])){
						sap.ui.getCore().byId(idArr[i]).setEnabled(flag);
					}
				}
			},
			
			// Set key inputs as disabled/enabled for editting
			// Arguments: dialog = object dialog, flag = boolean flag for enabled/disabled
			setEnabledDialog: function(dialog, flag){
				var inputs = dialog.getAggregation("content");
				for(var i in inputs){
					for(var j in this.typeArr){
						var type = this.typeArr[j];
						var input = inputs[i];
						if(input["mBindingInfos"].hasOwnProperty(type) && !input.data("disabled")){
							if(input.data("key")){
								input.setEnabled(flag);
							}else{
								input.setEnabled(true);
							}
						}
					}
					
				}
			},
			
			// Checks the key values to lock them on dialogEdit
			checkKeys: function(dialog){
				var check = this.getModel('i18n').getResourceBundle().getText("plsEnter");
				var inputs = dialog.getAggregation("content");
				for(var i in inputs){
					var oInput = inputs[i];
					if(oInput.data("key") && !oInput.data("checkOmit")){
						if((oInput["mProperties"].hasOwnProperty("value") && !oInput.getValue()) || 
						(oInput["mProperties"].hasOwnProperty("selectedKey") && !oInput.getSelectedKey()) ||
						(oInput["mProperties"].hasOwnProperty("value") && !oInput.getValue()) ||
						(oInput.hasOwnProperty("_oMaxDate") && !oInput.getDateValue())){
							check = check + " " + this.getModel('i18n').getResourceBundle().getText(oInput.data("key")) + ", ";
						}
					}
				}
				return check;
			},
			
			// Double click event to open dialog
			onDoubleClick: function(id){
				var table = this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
				if(table.getSelectedItem()){
					var dialog = this[id + "Dialog"];
					var url = table.getSelectedItem().getBindingContextPath();
					dialog.bindElement(url);
					this.setDisabledDialog(dialog);
					var buttons = dialog.getButtons();
					buttons[1].setVisible(false);
					buttons[2].setVisible(true);
					buttons[3].setVisible(true).setEnabled(false);
					sap.ui.getCore().byId(id + "EditContent").setVisible(true);
					sap.ui.getCore().byId(id + "AddContent").setVisible(false);
					dialog.open();
				}else{
					return true;
				}
			},
			
			// Set key all inputs as disabled for editting
			// Arguments: dialog = object dialog
			setDisabledDialog: function(dialog){
				var inputs = dialog.getAggregation("content");
				for(var i in inputs){
					for(var j in this.typeArr){
						var type = this.typeArr[j];
						var input = inputs[i];
						if(input["mBindingInfos"].hasOwnProperty(type)){
							input.setEnabled(false);
						}
					}
				}
			}

		});

	}
);