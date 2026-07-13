declare module '@paypal/checkout-server-sdk' {
  namespace core {
    class PayPalHttpClient {
      constructor(environment: SandboxEnvironment | LiveEnvironment)
      execute<T = any>(request: any): Promise<{ result: T; statusCode: number }>
    }
    class SandboxEnvironment {
      constructor(clientId: string, clientSecret: string)
    }
    class LiveEnvironment {
      constructor(clientId: string, clientSecret: string)
    }
  }

  namespace orders {
    class OrdersCreateRequest {
      prefer(preference: string): void
      requestBody(body: any): void
    }
    class OrdersGetRequest {
      constructor(orderId: string)
    }
    class OrdersCaptureRequest {
      constructor(orderId: string)
      requestBody(body: any): void
    }
  }

  namespace payments {
    class CapturesRefundRequest {
      constructor(captureId: string)
      requestBody(body: any): void
    }
  }
}
