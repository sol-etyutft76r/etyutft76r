import { Utils } from "../_helpers/utils";
import { Tag } from "./device";

export class Report {
    id: string;
    name: string;
    receiver?: string;
    scheduling: string;
    docproperty: ReportDocProperty;
    content?: ReportContent; 
    constructor(_id: string) {
        this.id = _id;
        this.docproperty = this.defaultDocProperty();
        this.scheduling = Utils.getEnumKey(ReportSchedulingType, ReportSchedulingType.week);
        this.content = <ReportContent> { items: [] };
    }

    defaultDocProperty() {
        return <ReportDocProperty> { 
            pageSize: 'A4',
            pageOrientation: 'portrait',        // landscape 
            pageMargins: [ 60, 60, 40, 60 ],    // [left, top, right, bottom] or [horizontal, vertical] or just a number for equal margins
            fontName: 'Helvetica',
        }
    }
}

export enum ReportSchedulingType {
    none = 'report.scheduling-none',
    day = 'report.scheduling-day',
    week = 'report.scheduling-week',
    month = 'report.scheduling-month',
}

export interface ReportContent {
    items?: ReportItem[];
}

export interface ReportDocProperty {
    paper?: string;
    margin?: ReportPageMargin;
    fontName?: string;
}

export interface ReportPageMargin {
    top: number,
    bottom: number,
    left: number,
    right: number
}

export interface ReportItem {
    type: ReportItemType,
    align?: string,
    width?: number,
    size?: number,
}

export interface ReportItemText extends ReportItem {
    text: string;
}
export interface ReportItemTable extends ReportItem {
    columns: ReportTableColumn[],
    range: ReportDateRangeType,
    maxrow: number,
}

export interface ReportTableColumn {
    type: ReportTableColumnType;
    tag: Tag,
    align: string;
    width: string,
}

export enum ReportTableColumnType {
    timestamp = 0,
    tag = 1,
}

export enum ReportItemType {
    text = 'report.item-type-text',
    table = 'report.item-type-table',
}

export enum ReportDateRangeType {
    one = 'report.item-daterange-none',
    day = 'report.item-daterange-day',
    week = 'report.item-daterange-week',
    month = 'report.item-daterange-month',
}

export const REPORT_PREFIX = 'r_';
