/*global location */
sap.ui.define([
		"managerisks/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"managerisks/model/formatter",
		'sap/m/MessageToast',
		'sap/m/MessageBox',
		"sap/ui/model/Filter",
		"sap/ui/model/FilterOperator"
	], function (BaseController, JSONModel, formatter, MessageToast, MessageBox, Filter, FilterOperator) {
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
					this.byId("main").bindElement({
						path: this.objectPath + "/ToUserFunction",
						events: {
							dataReceived: this.dataReceived.bind(this)
						}
					}).setVisible(true);
					
					if(this.ItemType === "R"){
						risks.setVisible(true);
						this.bindTable("risksTable", this.objectPath + "/ToRisksCounterparty");
						this.bindTable("risksCountryTable", this.objectPath + "/ToRisksCountry");
						// Set enabled send button if risks, since can be disabled after limits
						this.byId("sendButton").setEnabled(true);
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
						
						// Set disabled send button if limits, since activated by checkbox approved by
						this.byId("sendButton").setEnabled(false);
					}
				}.bind(this));
			},
			
			dataReceived: function(oData){
				var data = oData.getParameter("data");
				this.UserFunc = data.UserFunc;
				this.DocumentType = data.DocumentType;
				var openDeal = this.byId("openDeal");
				if(this.DocumentType === "O"){
					openDeal.data("url", "/sap/bc/ui2/flp#ZTS_OFFER_APPROVE-display&/TCNumber/" + this.TCNumber + "//Display");
					openDeal.setText(this.getResourceBundle().getText("openOffer"));
				}else if(this.DocumentType === "D"){
					openDeal.data("url", "/sap/bc/ui2/flp#ZTS_TC_DEAL-display?DealID=" + this.TCNumber);
					openDeal.setText(this.getResourceBundle().getText("openDeal"));
				}
				if(this.UserFunc === "L"){
					this.byId("discardButton").setVisible(true);
				}else{
					this.byId("discardButton").setVisible(false);
				}
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
				window.open("/sap/bc/ui2/flp#ZTS_BUSINESS_PARTNER-display&/CounterpartyHeaderSet/" + counterParty);
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
				var that = this;
				MessageBox.confirm(that.getResourceBundle().getText("askContinue"), {
					actions: [that.getResourceBundle().getText("send"), sap.m.MessageBox.Action.CLOSE],
					onClose: function(sAction) {
						if (sAction === that.getResourceBundle().getText("send")) {
							var link = that.ItemType === "R" ? 'ApproveRisks' : 'ApproveLimits';
							var oFuncParams = { 
								TCNumber: that.TCNumber
							};
							if(that.ItemType === "L"){
								oFuncParams.IsApproved = that.byId("withMembers").getSelected();
								oFuncParams.ApprovalDate = that.byId("approvalDate").getDateValue() ? that.byId("approvalDate").getDateValue() : new Date();
							}
							that.getModel().callFunction("/" + link, {
								method: "POST",
								urlParameters: oFuncParams,
								success: that.onApproveSuccess.bind(that, link)
							});
						} else {
							MessageToast.show("Sending canceled!");
						}
					}
				});
			},
			
			openDeal: function(oEvent){
				var url = oEvent.getSource().data("url");
				window.open(url);
			},
			
			onApproveSuccess: function(link, oData) {
				var oResult = oData[link];
				if (oResult.ActionSuccessful) {
					var eventBus = sap.ui.getCore().getEventBus();
					eventBus.publish("DetailMasterChannel", "onApproveEvent");
					
					var mailAddress = "mailto:" + oResult.Recipient;
					var mailSubject = "?subject=" + oResult.Message;
					var mailBody = "&body=" + oResult.BodyMail;
					var fullMail = mailAddress + mailSubject + mailBody;
					window.open(fullMail);
					MessageBox.alert(oResult.Message, {
						actions: [sap.m.MessageBox.Action.CLOSE]
					});
					this.byId("main").setVisible(false);
					this.byId("page").setTitle(this.getResourceBundle().getText("detailTitle"));
				} else {
					MessageBox.error(oResult.Message);
				}
			},
			
			onCloseDetailPress: function () {
				this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
				// No item should be selected on master after detail page is closed
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				var settings = {};
				if(this.ItemType){
					settings.ItemType = this.ItemType;      
				}
				this.getRouter().navTo("master", settings);
			},
			
			// Table buttons function for create/edit/copy/delete of items
			tableAdd: function(oEvent) {
				var id = oEvent.getSource().data("id");
				var dialog = this[id + "Dialog"];
				dialog.unbindElement();
				this.setEnabledDialog(dialog, true);
				sap.ui.getCore().byId(id + "EditContent").setVisible(false);
				var select = sap.ui.getCore().byId(id + "AddContent");
				var filters = [new Filter("TCNumber", FilterOperator.EQ, this.TCNumber)];
				select.setVisible(true).bindItems({
					path: "/DictionaryCounterpartyDealSet",
					template: select['mBindingInfos'].items.template,
					filters: filters
				});
				var buttons = dialog.getButtons();
				buttons[1].setVisible(true);
				buttons[2].setVisible(false);
				buttons[3].setVisible(false);
				
				if(this.UserFunc === "L"){
					this.setInputEnabled(["riskDescription", "riskActions", "riskLawyerComment", "riskEliminated"], true);
					this.setInputEnabled(["riskAgreement"], false);
				}else if(this.UserFunc === "T"){
					this.setInputEnabled(["riskDescription", "riskActions", "riskLawyerComment", "riskEliminated"], false);
					this.setInputEnabled(["riskAgreement"], true);
				}
				
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
				
				if(this.UserFunc === "L"){
					this.setInputEnabled(["riskDescription", "riskActions", "riskLawyerComment", "riskEliminated"], true);
					this.setInputEnabled(["riskAgreement"], false);
				}else if(this.UserFunc === "T"){
					this.setInputEnabled(["riskDescription", "riskActions", "riskLawyerComment", "riskEliminated"], false);
					this.setInputEnabled(["riskAgreement"], true);
				}
				
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
				var dialog = button.getParent();
				var id =  button.data("id");
				var url = button.data("url") ? "/" + button.data("url") : "/" + id + "Set";
				var oModel = dialog.getModel();
				var oData = this.getOdata(dialog);
				oData.TCNumber = this.TCNumber;
				var bCheckAlert = this.checkKeys(dialog);
				if(bCheckAlert === "Please, enter"){
					oModel.create(url, oData);
					dialog.close();
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
				if(Object.keys(changedData).length > 0){
					dialog.getModel().update(url, changedData);
				}
				dialog.close();
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
					if(this.UserFunc === "L"){
						this.setInputEnabled(["riskDescription", "riskActions", "riskLawyerComment", "riskEliminated"], true);
						this.setInputEnabled(["riskAgreement"], false);
					}else if(this.UserFunc === "T"){
						this.setInputEnabled(["riskDescription", "riskActions", "riskLawyerComment", "riskEliminated"], false);
						this.setInputEnabled(["riskAgreement"], true);
					}
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
					var input = this.byId(idArr[i]) || sap.ui.getCore().byId(idArr[i]);
					input.setEnabled(flag);
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
			},
			
			// On checkbox set enabled/disabled
			onCheckBox: function(oEvent){
				var check = oEvent.getSource();
				var selected = oEvent.getParameters("selected").selected;
				var id = check.data("id");
				var obj = this.byId(id) || sap.ui.getCore().byId(id);
				obj.setEnabled(selected);
				
				// if approved by checked then set date approval enabled
				this.byId("approvalDate").setEnabled(selected);
				if(!selected){
					this.byId("approvalDate").setDateValue(null).fireChange();
				}
			},
			
			// On limits date approval change set send button enabled
			onDateChange: function(oEvent){
				var newDate = oEvent.getParameter("newValue");
				newDate ? this.byId("sendButton").setEnabled(true) : this.byId("sendButton").setEnabled(false);
			},
			
			discard: function(){
				var oFuncParams = {
					TCNumber: this.TCNumber,
					ItemType: this.ItemType
				};
				this.getModel().callFunction("/Discard", {
					method: "POST",
					urlParameters: oFuncParams,
					success: this.onDiscardSuccess.bind(this, "Discard")
				});
			},
			
			onDiscardSuccess: function(link, oData) {
				var oResult = oData[link];
				if (oResult.ActionSuccessful) {
					this.byId("main").setVisible(false);
					this.byId("page").setTitle(this.getResourceBundle().getText("detailTitle"));
					var eventBus = sap.ui.getCore().getEventBus();
					eventBus.publish("DetailMasterChannel", "onApproveEvent");
					MessageBox.alert(oResult.Message, {
						actions: [sap.m.MessageBox.Action.CLOSE]
					});
				} else {
					MessageBox.error(oResult.Message);
				}
			}
		});

	}
);