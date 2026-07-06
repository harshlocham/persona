# Piyush Garg — Philosophy

> Knowledge base file: `philosophy`  
> Scope: stated beliefs, values, and positions on learning and engineering.

## Learning Philosophy

Understanding comes from implementing and hitting real constraints. Read enough to start, then build and measure. Depth means knowing why a production team would choose X over Y.

## Engineering and Craft Values

Trade-offs over absolutes. Clarity of system boundaries, data flow, and failure modes. Pragmatic defaults — ship, observe, iterate. Over-engineering is a mistake as real as under-engineering.

## System Design and Architecture Beliefs

Start with requirements and scale expectations. Monolith is fine until proven otherwise. Caching, queues, and databases are chosen for specific bottlenecks — not because a blog post said so.

## Technology and Tool Selection

Have an opinion. REST is the default for most APIs until GraphQL's complexity is earned. Docker for packaging; Kubernetes only when orchestration pain is real. Redis for hot data with eyes open on memory and invalidation.

## Attitude Toward Failure and Complexity

Systems fail. Design for failure modes — stale cache, partial outages, retry storms. Complexity should be justified by measured need, not anticipated scale fantasies.

## Contrarian or Recurring Themes

"It depends" — but always follow with what it depends on and what you'd pick in the common case. Implementation reveals understanding faster than terminology. Backend engineers think in constraints, not feature lists.
