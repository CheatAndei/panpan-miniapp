const LETTERS=['A','B','C','D'];

function numericOptions(correct,distractors,index=0,suffix=''){
  const values=[correct,...distractors].map(String).filter((value,pos,list)=>list.indexOf(value)===pos).slice(0,4);
  while(values.length<4)values.push(String(Number(correct)+values.length+3));
  const shift=index%4;
  const rotated=[...values.slice(shift),...values.slice(0,shift)];
  const options=Object.fromEntries(LETTERS.map((letter,pos)=>[letter,`${rotated[pos]}${suffix}`]));
  return {options,correct_option:LETTERS[rotated.indexOf(String(correct))]};
}

function numeric(topic,index,stem,correct,distractors,explanation,suffix=''){
  return {stable_code:`G8K-${topic.toUpperCase()}-${String(index+1).padStart(2,'0')}`,topic_key:topic,stem,
    ...numericOptions(correct,distractors,index,suffix),explanation,difficulty:index<3?1:index<6?2:3};
}

function choice(topic,index,stem,options,correct,explanation,difficulty=2){
  return {stable_code:`G8K-${topic.toUpperCase()}-${String(index+1).padStart(2,'0')}`,topic_key:topic,stem,options,
    correct_option:correct,explanation,difficulty};
}

const topics=[
  {topic_key:'triangles',chapter_name:'第十一章 三角形',title:'三角形基础',knowledge_card:'三角形内角和为 180°；任意两边之和大于第三边；外角等于与它不相邻的两个内角之和。'},
  {topic_key:'congruence',chapter_name:'第十二章 全等三角形',title:'全等判定',knowledge_card:'常用判定有 SSS、SAS、ASA、AAS；直角三角形还可用 HL。SSA 与 AAA 不能单独判定全等。'},
  {topic_key:'axis_symmetry',chapter_name:'第十三章 轴对称',title:'轴对称与坐标',knowledge_card:'关于 x 轴对称：横坐标不变、纵坐标变号；关于 y 轴对称：纵坐标不变、横坐标变号。'},
  {topic_key:'polynomial_mul',chapter_name:'第十四章 整式乘法',title:'乘法公式',knowledge_card:'(a+b)²=a²+2ab+b²；(a-b)²=a²-2ab+b²；(a+b)(a-b)=a²-b²。'},
  {topic_key:'factorization',chapter_name:'第十四章 因式分解',title:'因式分解',knowledge_card:'先看公因式，再看公式。因式分解必须化成几个整式乘积，并分解到不能继续。'},
  {topic_key:'fractions',chapter_name:'第十五章 分式',title:'分式与分式方程',knowledge_card:'分式有意义要求分母不为 0；解分式方程去分母后必须检验，增根要舍去。'},
  {topic_key:'constructions',chapter_name:'专题 尺规作图',title:'基本尺规作图',knowledge_card:'尺规作图只使用无刻度直尺和圆规。基本作图包括垂直平分线、角平分线、作已知角等。'},
  {topic_key:'auxiliary_lines',chapter_name:'专题 辅助线',title:'常见辅助线',knowledge_card:'看到中点可考虑倍长中线；等腰三角形常作底边上的高；角平分线问题常向两边作垂线。'},
  {topic_key:'geometry_formulas',chapter_name:'专题 几何公式',title:'几何定理公式',knowledge_card:'n 边形内角和为 (n−2)×180°，外角和恒为 360°；等腰三角形两底角相等。'},
].map((item,index)=>({...item,sort_order:index+1}));

const questions=[];

[[52,68],[45,75],[37,86],[64,41],[28,103],[71,54],[33,97],[82,36]].forEach(([a,b],index)=>{
  const correct=180-a-b;
  questions.push(numeric('triangles',index,`三角形两个内角分别为 ${a}°、${b}°，第三个内角是多少？`,correct,[180-a,180-b,a+b],`三角形内角和为 180°，所以第三角为 180°−${a}°−${b}°=${correct}°。`,'°'));
});

[
  ['已知三边分别相等，可用哪种方法判定两个三角形全等？',{A:'SSS',B:'SAS',C:'ASA',D:'AAA'},'A','三边分别相等，对应 SSS。'],
  ['已知两边及其夹角分别相等，可用哪种方法判定全等？',{A:'AAS',B:'SAS',C:'SSA',D:'AAA'},'B','两边及夹角对应 SAS。'],
  ['已知两角及其夹边分别相等，可用哪种方法判定全等？',{A:'ASA',B:'SSS',C:'SSA',D:'HL'},'A','两角及夹边对应 ASA。'],
  ['两个直角三角形的斜边和一条直角边分别相等，可用哪种方法？',{A:'AAA',B:'SSA',C:'HL',D:'AAS'},'C','直角三角形可使用斜边、直角边 HL 判定。'],
  ['下列条件不能单独判定两个三角形全等的是哪一个？',{A:'SSS',B:'SAS',C:'ASA',D:'AAA'},'D','AAA 只能说明形状相同，大小未必相同。'],
  ['“两边和其中一边的对角分别相等”通常不能判定全等，这属于哪种情形？',{A:'SSA',B:'SAS',C:'AAS',D:'SSS'},'A','两边及非夹角是 SSA，通常不能判定全等。'],
  ['由 △ABC≌△DEF，且 A、B、C 分别对应 D、E、F，可得哪组边相等？',{A:'AB=DF',B:'BC=EF',C:'AC=DE',D:'AB=EF'},'B','对应顶点顺序确定 B↔E、C↔F，所以 BC=EF。'],
  ['要证明两条线段相等，常把它们放入两个三角形并证明什么？',{A:'相似',B:'等腰',C:'全等',D:'直角'},'C','全等三角形的对应边相等。'],
].forEach((item,index)=>questions.push(choice('congruence',index,...item,index<3?1:2)));

[[2,3],[-4,5],[6,-2],[-3,-7],[8,1],[-5,4],[1,-9],[-7,-6]].forEach(([x,y],index)=>{
  const modes=index%2?'y':'x';
  const correct=modes==='x'?`(${x}, ${-y})`:`(${-x}, ${y})`;
  const options=modes==='x'
    ? {A:`(${x}, ${-y})`,B:`(${-x}, ${y})`,C:`(${-x}, ${-y})`,D:`(${y}, ${x})`}
    : {A:`(${x}, ${-y})`,B:`(${-x}, ${y})`,C:`(${-x}, ${-y})`,D:`(${y}, ${x})`};
  const correctOption=Object.entries(options).find(([,value])=>value===correct)[0];
  questions.push(choice('axis_symmetry',index,`点 P(${x}, ${y}) 关于 ${modes==='x'?'x':'y'} 轴的对称点坐标是？`,options,correctOption,
    modes==='x'?'关于 x 轴对称时横坐标不变，纵坐标变号。':'关于 y 轴对称时纵坐标不变，横坐标变号。',index<4?1:2));
});

[
  ['(x+3)² 的展开式是？',{A:'x²+9',B:'x²+6x+9',C:'x²+3x+9',D:'x²−6x+9'},'B','使用完全平方公式 (a+b)²=a²+2ab+b²。'],
  ['(x−5)² 的展开式是？',{A:'x²−25',B:'x²−10x+25',C:'x²−5x+25',D:'x²+10x+25'},'B','(x−5)²=x²−10x+25。'],
  ['(a+4)(a−4) 的结果是？',{A:'a²−16',B:'a²+16',C:'a²−8a+16',D:'a²+8a+16'},'A','使用平方差公式 (a+b)(a−b)=a²−b²。'],
  ['(2x+3)(2x−3) 的结果是？',{A:'4x²−9',B:'2x²−9',C:'4x²+9',D:'4x²−12x+9'},'A','把 2x 看成 a、3 看成 b，使用平方差公式。'],
  ['(x+2)(x+7) 的结果是？',{A:'x²+9x+14',B:'x²+14x+9',C:'x²+5x+14',D:'x²+9'},'A','逐项相乘并合并同类项，得 x²+9x+14。'],
  ['(3x−1)² 的结果是？',{A:'9x²−1',B:'9x²−6x+1',C:'3x²−6x+1',D:'9x²+6x+1'},'B','(3x−1)²=9x²−6x+1。'],
  ['计算 (m+n)²−(m−n)²。',{A:'2mn',B:'4mn',C:'2m²+2n²',D:'4m²'},'B','分别展开后相减，中间项相加得到 4mn。'],
  ['若 x+y=6，xy=5，则 x²+y² 等于？',{A:'26',B:'31',C:'36',D:'46'},'A','x²+y²=(x+y)²−2xy=36−10=26。'],
].forEach((item,index)=>questions.push(choice('polynomial_mul',index,...item,index<3?1:index<6?2:3)));

[
  ['分解因式：x²−9。',{A:'(x−3)²',B:'(x+3)(x−3)',C:'x(x−9)',D:'(x+9)(x−1)'},'B','x²−9=x²−3²=(x+3)(x−3)。'],
  ['分解因式：x²+6x+9。',{A:'(x+3)²',B:'(x−3)²',C:'x(x+6)+9',D:'(x+9)(x+1)'},'A','符合完全平方公式 a²+2ab+b²。'],
  ['分解因式：3x²+6x。',{A:'3x(x+2)',B:'3x(x+6)',C:'x(3x+2)',D:'3(x²+2x)'},'A','先提取公因式 3x，得到 3x(x+2)。'],
  ['分解因式：4a²−25。',{A:'(2a−5)²',B:'(4a+5)(a−5)',C:'(2a+5)(2a−5)',D:'(a+5)(4a−5)'},'C','4a²−25=(2a)²−5²。'],
  ['分解因式：x²−8x+16。',{A:'(x−4)²',B:'(x+4)²',C:'(x−8)(x+2)',D:'x(x−8)+16'},'A','符合 a²−2ab+b²=(a−b)²。'],
  ['分解因式：2x²−18。',{A:'2(x−9)(x+1)',B:'2(x+3)(x−3)',C:'(2x+3)(x−6)',D:'2(x−3)²'},'B','先提 2，再用平方差：2(x²−9)=2(x+3)(x−3)。'],
  ['下列等式属于因式分解的是？',{A:'x(x+1)=x²+x',B:'x²−1=(x+1)(x−1)',C:'(x+2)²=x²+4x+4',D:'2x+2=x+x+2'},'B','因式分解要把多项式写成整式乘积。'],
  ['分解因式后还应检查什么？',{A:'是否写成加法',B:'是否还能继续分解',C:'是否出现分母',D:'是否交换了项'},'B','因式分解应进行到每个因式不能继续分解。'],
].forEach((item,index)=>questions.push(choice('factorization',index,...item,index<3?1:index<6?2:3)));

[
  ['分式 1/(x−2) 有意义的条件是？',{A:'x=2',B:'x≠2',C:'x>2',D:'x<2'},'B','分母不能为 0，所以 x−2≠0。'],
  ['约分：6x²/(3x)，其中 x≠0。',{A:'2x',B:'2x²',C:'3x',D:'x/2'},'A','分子分母同时除以 3x，得到 2x。'],
  ['计算 1/x+2/x（x≠0）。',{A:'3/x',B:'3/(2x)',C:'2/x²',D:'3x'},'A','同分母分式分子相加，分母不变。'],
  ['计算 a/b×b/c（b、c≠0）。',{A:'a/c',B:'ab/c',C:'a/(bc)',D:'b/(ac)'},'A','约去公因式 b，得到 a/c。'],
  ['解分式方程后必须进行哪一步？',{A:'平方',B:'检验',C:'配方',D:'画图'},'B','去分母可能产生增根，必须代回最简公分母检验。'],
  ['方程 1/(x−1)=0 的解是？',{A:'x=0',B:'x=1',C:'无解',D:'任意实数'},'C','分式的分子为 1，不可能等于 0；x=1 又使分母为 0。'],
  ['若最简公分母为 x(x−2)，则未知数应满足？',{A:'x≠0',B:'x≠2',C:'x≠0 且 x≠2',D:'x>2'},'C','每个分母因式都不能为 0。'],
  ['把分式方程两边同乘最简公分母的主要目的是？',{A:'去分母',B:'开平方',C:'去括号',D:'移项'},'A','同乘最简公分母可把分式方程转化为整式方程。'],
].forEach((item,index)=>questions.push(choice('fractions',index,...item,index<3?1:index<6?2:3)));

[
  ['尺规作图中的“尺”指什么？',{A:'带刻度直尺',B:'无刻度直尺',C:'三角板',D:'量角器'},'B','尺规作图只使用无刻度直尺和圆规。'],
  ['线段垂直平分线上的点具有什么性质？',{A:'到两端点距离相等',B:'到直线距离为 0',C:'到原点距离相等',D:'横坐标相等'},'A','垂直平分线是到线段两端点距离相等的点的集合。'],
  ['角平分线上的点到角的两边距离如何？',{A:'不相等',B:'相等',C:'和为 180°',D:'乘积为 1'},'B','角平分线上的点到角两边的距离相等。'],
  ['作线段 AB 的垂直平分线时，圆规半径应满足？',{A:'小于 AB 的一半',B:'等于 0',C:'大于 AB 的一半',D:'任意'},'C','半径大于 AB 一半，分别以 A、B 为圆心作弧才能有两个交点。'],
  ['已知三边作三角形，第一步通常是？',{A:'作其中一条边',B:'作角平分线',C:'作高',D:'作中线'},'A','先作一条已知长度的边，再用圆弧确定第三个顶点。'],
  ['作一个角等于已知角，主要利用什么确定角的大小？',{A:'两圆弧交点',B:'直尺刻度',C:'量角器读数',D:'坐标'},'A','复制已知角时用相同半径和弦长确定新角。'],
  ['下列工具不属于传统尺规作图允许使用的是？',{A:'圆规',B:'无刻度直尺',C:'量角器',D:'铅笔'},'C','量角器会直接测量角度，不属于尺规作图工具。'],
  ['作图完成后，说明作图正确通常依据什么？',{A:'图形看起来像',B:'相关几何性质',C:'线条颜色',D:'纸张大小'},'B','必须用垂直平分线、全等、角平分线等性质说明。'],
].forEach((item,index)=>questions.push(choice('constructions',index,...item,index<4?1:2)));

[
  ['等腰三角形证明底角相等，常作哪条辅助线？',{A:'底边上的高',B:'任意射线',C:'外角平分线',D:'平行于腰的线'},'A','底边上的高常同时成为中线和顶角平分线，便于构造全等。'],
  ['题目出现线段中点，想构造全等时常用什么方法？',{A:'倍长中线',B:'作圆',C:'作切线',D:'平移角'},'A','倍长中线可利用中点形成对顶角和对应边相等。'],
  ['角平分线问题中，常从角平分线上的点作什么？',{A:'向两边作垂线',B:'作中线',C:'作外接圆',D:'作平行四边形'},'A','这样可直接使用角平分线上的点到两边距离相等。'],
  ['看到两条平行线，构造角相等时应优先想到？',{A:'同位角或内错角',B:'圆周角',C:'中心角',D:'补角都相等'},'A','平行线可提供同位角、内错角相等。'],
  ['证明两条线段和等于第三条线段，常考虑？',{A:'截长补短',B:'只比较角度',C:'作随机垂线',D:'测量长度'},'A','截长补短把线段和差转化为可用全等证明的对应边。'],
  ['矩形或规则图形出现对称关系时，可优先考虑？',{A:'作对称点',B:'删除一条边',C:'改变角度',D:'延长所有边'},'A','作对称点能转移线段或角，形成全等结构。'],
  ['辅助线的主要作用是？',{A:'让图更复杂',B:'把已知条件连接成可用定理的结构',C:'改变原题条件',D:'代替证明'},'B','辅助线不改变条件，只用于构造全等、相似或等量关系。'],
  ['添加辅助线后，证明中必须做到什么？',{A:'说明构造并给出依据',B:'只看图猜结论',C:'省略对应关系',D:'重新定义已知'},'A','辅助线的构造和后续每个等量关系都需要有依据。'],
].forEach((item,index)=>questions.push(choice('auxiliary_lines',index,...item,index<4?1:2)));

[[5,540],[6,720],[7,900],[8,1080],[9,1260],[10,1440],[12,1800],[15,2340]].forEach(([n,correct],index)=>{
  questions.push(numeric('geometry_formulas',index,`${n} 边形的内角和是多少？`,correct,[n*180,(n-1)*180,360],`n 边形内角和为 (n−2)×180°=(${n}−2)×180°=${correct}°。`,'°'));
});

module.exports={version:'g8-math-v1',topics,questions};
