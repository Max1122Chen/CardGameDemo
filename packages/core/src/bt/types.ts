export type BtStatus = 'Success' | 'Failure' | 'Running';

export type BlackboardValue = number | boolean | string;

export type BlackboardCompareOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

export type BtNode =
  | BtSequenceNode
  | BtSelectorNode
  | BtRepeatNode
  | BtInverterNode
  | BtSucceedNode
  | BtFailNode
  | BtTaskNode
  | BtWaitNode
  | BtBlackboardCompareNode;

export type BtSequenceNode = {
  type: 'Sequence';
  children: BtNode[];
};

export type BtSelectorNode = {
  type: 'Selector';
  children: BtNode[];
};

export type BtRepeatNode = {
  type: 'Repeat';
  child: BtNode;
};

export type BtInverterNode = {
  type: 'Inverter';
  child: BtNode;
};

export type BtSucceedNode = {
  type: 'Succeed';
  child: BtNode;
};

export type BtFailNode = {
  type: 'Fail';
  child: BtNode;
};

export type BtTaskNode = {
  type: 'Task';
  actionId: string;
  params?: Record<string, unknown>;
};

export type BtWaitNode = {
  type: 'Wait';
};

export type BtBlackboardCompareNode = {
  type: 'BlackboardCompare';
  key: string;
  op: BlackboardCompareOp;
  value: BlackboardValue;
};

export type BehaviorTreeAsset = {
  id: string;
  root: BtNode;
};

export type WireBtNode = {
  type: string;
  children?: WireBtNode[];
  child?: WireBtNode;
  actionId?: string;
  params?: Record<string, unknown>;
  key?: string;
  op?: string;
  value?: BlackboardValue;
};

export type WireBehaviorTree = {
  id: string;
  root: WireBtNode;
};
