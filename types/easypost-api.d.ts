declare module '@easypost/api' {
  export interface Rate {
    id: string
    carrier?: string
    service?: string
    rate?: string
    currency?: string
    delivery_days?: number
    delivery_date?: string
    delivery_date_guaranteed?: boolean
  }

  export interface Shipment {
    id: string
    rates?: Rate[]
  }

  export default class EasyPostClient {
    constructor(apiKey: string)
    Shipment: {
      create(params: any): Promise<Shipment>
    }
  }
}
