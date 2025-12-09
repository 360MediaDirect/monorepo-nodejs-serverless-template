export const mockPublish = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
}) as jest.MockedFunction<any>

export class SNS {
  publish = mockPublish
}

export default {
  SNS,
}
