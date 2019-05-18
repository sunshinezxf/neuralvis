def is_linear(node_num, path_list):
    """
    :param node_num: 节点的数量
    :param path_list: 端点数组[{from: '', to: '', ...},...]
    :return: 判断图是否为线性图
    """
    # 线性图n个节点具有n-1条边,只有一个点没有入边
    path_num = len(path_list)
    # 只有一层
    if path_num == 0 and node_num == 1:
        return True
    in_layer = []
    if node_num - 1 == len(path_list):
        for item in path_list:
            # 每一个item都应该是一个包含两个数值的元组,第一个数为出的层，第二个数为入的层
            in_layer.append(item['to'])
        # 读取完所有的边之后，将in_layer转换成集合
        if len(in_layer) == len(set(in_layer)):
            return True
    return False


def sort_layer(layer_list, path_list, node_num):
    """
    :param layer_list: 传入的无序的layer信息
    :param path_list: 传入的无序的路径列表信息, 使用名称
    :param node_num: 传入总的层数（节点数量）
    :return:
    """
    if is_linear(node_num, path_list):
        # 将path_list排序
        # 用于记录所有的层的节点
        layers = []
        # 用于记录所有的含有入边的层的节点
        in_layer = []
        # 将边的记录形式存储为path[out] = in
        path = dict()
        for item in path_list:
            in_layer.append(item['to'])
            layers.append(item['from'])
            layers.append(item['to'])
            path[item['from']] = item['to']
        # 去除重复的层的节点
        layers = set(layers)
        in_layer = set(in_layer)
        # 只有起始层没有入边,因此他们的差集应为只包含一个元素的集合
        initial = list(layers.difference(in_layer))[0]
        result = [layer_list[index_of(layer_list, initial)]]
        # 从起始点开始追溯这个线性结构
        while initial in path:
            initial = path[initial]
            result.append(layer_list[index_of(layer_list, initial)])
        return result
    return None


def index_of(layer_list, layer_name):
    """
    查找某一个layer在 layer_list中的index
    :param layer_list:
    :param layer_name:
    :return:
    """
    # print(layer_list)
    for index in range(len(layer_list)):
        print(layer_list[index]['config'].keys())
        if layer_name == layer_list[index]['config']['name']:
            return index
    return -1
