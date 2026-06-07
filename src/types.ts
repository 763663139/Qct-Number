/**
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProductMapping {
  productId: string;
  shop: string;        // 店铺
  shortName: string;   // 产品简称
  marketerName: string;// 姓名
  fullName?: string;   // 产品全称 (mapped from data sheets)
}

export interface QctRecord {
  productId: string;
  productName: string;
  promoName: string;
  spend: number;
  marketerName: string;
  shop: string;
  shortName: string;
}

export interface PddProcessedProduct {
  pid: number;
  shortName: string;   // 产品简称
  pname: string;       // 姓名
  shop: string;        // 店铺
  group: string;       // 组
  shell_money: number; // 真实销售额 (商家实收金额 - 刷单 - 放单)
  sd_money: number;    // 刷单 (G- 或 g-)
  wb_money: number;    // 放单 (V- 或 v-)
  fullName?: string;   // 产品全称
}

export interface FileInfo {
  name: string;
  size: number;
  rowCount?: number;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMessage?: string;
}

export interface IndividualSummary {
  name: string;
  group: string;
  realSales: number;
  sdSales: number;
  wbSales: number;
  campaignSpend?: number; // Related promotional spend from QCT
}
